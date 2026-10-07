"use client";

import { useEffect, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRaw } from '../../../services/api';
import { toast } from 'sonner';
import { copyTextToClipboard } from '@/utils/clipboard';
import QRCode from 'qrcode';

export const PANTALLA_TOKEN_KEY = 'pantalla_token';

export interface VueloPantalla {
  id: number;
  hora: string;
  pilotoNombre: string;
  pilotoCategoria?: string | null;
  pasajeroNombre: string;
  pasajeroFirmaDeslinde: boolean;
  estado: string;
}

export interface PantallaData {
  fecha: string;
  clima: {
    estadoPista: string;
    velocidadViento?: number;
    rachaViento?: number;
    direccionViento?: string;
    temperatura?: number;
    visibilidad?: string;
    observaciones?: string;
  };
  vuelos: VueloPantalla[];
  totalVuelos: number;
  completados: number;
}

export interface PantallaLinkInfo {
  tipo: string;
  token: string;
  expiraEn: string;
  url: string;
}

// Enlaces admin del tablero (DIARIO / TV), cacheados por tipo.
function usePantallaLinkQuery(tipo: 'DIARIO' | 'TV', enabled: boolean) {
  return useQuery<PantallaLinkInfo>({
    queryKey: ['pantalla', 'link', tipo],
    queryFn: async () =>
      (await apiRaw.get('/pantalla/link', { params: { tipo } })) as unknown as PantallaLinkInfo,
    enabled,
    retry: false,
  });
}

export function usePantallaController() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<'loading' | 'ok' | 'invalid'>('loading');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');

  // Actualizar reloj digital cada segundo
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('es-CL', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
      setCurrentDateStr(
        now.toLocaleDateString('es-CL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling de datos en vivo cada 10 segundos
  const pantallaQuery = useQuery<PantallaData>({
    queryKey: ['public', 'pantalla', token],
    queryFn: async () =>
      (await apiRaw.get('/public/pantalla', { params: { token } })) as unknown as PantallaData,
    refetchInterval: 10_000,
    enabled: !!token,
    retry: false,
  });

  /* eslint-disable react-hooks/set-state-in-effect -- resolución del token desde URL/localStorage y estado de acceso por fetch; no es estado derivado */
  useEffect(() => {
    const urlToken = new URLSearchParams(window.location.search).get('token');
    const storedToken = localStorage.getItem(PANTALLA_TOKEN_KEY);
    const tokenActual = urlToken || storedToken;
    if (urlToken) {
      localStorage.setItem(PANTALLA_TOKEN_KEY, urlToken);
    }
    if (!tokenActual) {
      setAccessStatus('invalid');
      return;
    }
    setToken(tokenActual);
  }, []);

  // Cookie de admin para los enlaces (antes: la leía refreshLinks en cada fetch)
  useEffect(() => {
    setAdminToken(Cookies.get('token') ?? null);
  }, []);

  useEffect(() => {
    if (pantallaQuery.data) setAccessStatus('ok');
  }, [pantallaQuery.data]);

  // Manejo especial del 401 (enlace caducado o inválido): se ejecuta una sola
  // vez por error, guardado por identidad del error en el ref.
  const ultimoErrorRef = useRef<unknown>(null);
  useEffect(() => {
    const err = pantallaQuery.error;
    if (!err || err === ultimoErrorRef.current) return;
    ultimoErrorRef.current = err;
    const axiosErr = err as {
      isAxiosError?: boolean;
      response?: { status?: number; data?: { message?: string } };
    };
    if (axiosErr?.isAxiosError && axiosErr.response?.status === 401) {
      localStorage.removeItem(PANTALLA_TOKEN_KEY);
      setAccessStatus('invalid');
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Enlace del tablero caducado o inválido:', axiosErr.response.data?.message);
      }
    } else {
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error cargando datos de pantalla:', err);
      }
    }
  }, [pantallaQuery.error]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dailyLinkQuery = usePantallaLinkQuery('DIARIO', !!adminToken);
  const tvLinkQuery = usePantallaLinkQuery('TV', !!adminToken);

  const esErrorDeAcceso = (err: unknown) => {
    const axiosErr = err as { isAxiosError?: boolean; response?: { status?: number } };
    return (
      !!axiosErr?.isAxiosError &&
      (axiosErr.response?.status === 403 || axiosErr.response?.status === 401)
    );
  };

  const dailyLink = dailyLinkQuery.data ?? null;
  const tvLink = tvLinkQuery.data ?? null;
  // Admin = hay sesión y el enlace DIARIO respondió (antes: setIsAdmin(true)
  // solo tras el éxito de DIARIO); un 401/403 en cualquiera de los dos lo revoca.
  const isAdmin =
    !!adminToken &&
    !!dailyLink &&
    !esErrorDeAcceso(dailyLinkQuery.error) &&
    !esErrorDeAcceso(tvLinkQuery.error);

  const regenerateLinkMutation = useMutation({
    mutationFn: (tipo: 'DIARIO' | 'TV') =>
      apiRaw.post('/pantalla/link/regenerate', null, { params: { tipo } }),
    onSuccess: (res, tipo) => {
      queryClient.setQueryData(['pantalla', 'link', tipo], res as unknown as PantallaLinkInfo);
      toast.success(tipo === 'DIARIO' ? 'Enlace del día renovado' : 'Enlace TV renovado');
    },
    onError: (err) => {
      console.error(err);
      toast.error('No se pudo renovar el enlace');
    },
  });

  const regenerateLink = (tipo: 'DIARIO' | 'TV') => {
    regenerateLinkMutation.mutate(tipo);
  };

  const copyLink = async (key: string, text: string) => {
    const ok = await copyTextToClipboard(text);
    if (!ok) {
      toast.error('No se pudo copiar, copia manualmente el enlace');
      return;
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const saveTvToBrowser = () => {
    if (!tvLink) return;
    localStorage.setItem(PANTALLA_TOKEN_KEY, tvLink.token);
    setCopiedKey('tv-saved');
    toast.success('Enlace TV guardado en este navegador');
  };

  const openAdminPanel = () => {
    setShowAdminPanel(true);
    if (adminToken) {
      dailyLinkQuery.refetch();
      tvLinkQuery.refetch();
    }
  };

  const closeAdminPanel = () => {
    setShowAdminPanel(false);
  };

  const formatExpiry = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('es-CL', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      ...(d.getDate() !== new Date().getDate() && { day: '2-digit', month: '2-digit' }),
    });
  };

  // Generar QR para deslinde general
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      QRCode.toDataURL(`${origin}/reservas`, {
        width: 180,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }).then(setQrDataUrl).catch(console.error);
    }
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const data = pantallaQuery.data ?? null;
  // Cargando hasta el primer settle del fetch; sin token, hasta resolver acceso.
  const loading = token ? pantallaQuery.isPending : accessStatus === 'loading';

  return {
    data,
    loading,
    accessStatus,
    currentTime,
    currentDateStr,
    isFullscreen,
    qrDataUrl,
    isAdmin,
    showAdminPanel,
    dailyLink,
    tvLink,
    copiedKey,
    openAdminPanel,
    closeAdminPanel,
    toggleFullscreen,
    regenerateLink,
    copyLink,
    saveTvToBrowser,
    formatExpiry,
  };
}
