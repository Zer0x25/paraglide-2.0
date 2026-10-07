import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresaPublico } from '@/hooks/useEmpresaPublico';
import { useReservaPublica } from '@/hooks/useReservaPublica';
import { buildGoogleCalendarUrl, formatFechaEspanol } from '@parapente/shared';
import type { ReservaPublica, ReglaOperativaPublica } from '../types';

interface UseVoucherControllerProps {
  params: Promise<{ id: string }>;
}

export function useVoucherController({ params }: UseVoucherControllerProps) {
  const { empresa } = useEmpresaPublico();
  const nombreEscuela = empresa?.nombre ?? 'Parapente School';

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  const reglasQuery = useQuery({
    queryKey: ['reglas-operativas-public'],
    queryFn: async () => {
      try {
        const res = await axios.get(`${apiUrl}/public/reglas-operativas`);
        return res.data as unknown as ReglaOperativaPublica[];
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const puntoDeEncuentro =
    reglasQuery.data?.find((r) => r.categoria === 'PUNTO_ENCUENTRO' && r.esDefault)?.valor ||
    reglasQuery.data?.find((r) => r.clave === 'puntoDeEncuentro')?.valor ||
    'Zona de Despegue';

  const [reservaId, setReservaId] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrFallo, setQrFallo] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    Promise.resolve(params).then((p) => {
      if (p?.id) setReservaId(p.id);
    });
  }, [params]);

  const {
    data: reserva,
    isLoading: loading,
    error: errorReserva,
  } = useReservaPublica<ReservaPublica>(reservaId, {
    mensajeError: 'No se pudo cargar la información del voucher.',
  });

  // Generar QR para el deslinde (antes dentro del fetch; si el QR fallaba
  // caía al mismo error del voucher y se conserva ese comportamiento).
  useEffect(() => {
    if (!reserva) return;
    let active = true;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    // Enlaces públicos solo con identificadores no secuenciales (tokenPublico/shortId).
    // El fallback es el propio parámetro de la URL (ya resuelto por la API como token).
    const publicId = reserva.tokenPublico || reserva.shortId || reservaId;
    const deslindeUrl = `${origin}/deslinde/${publicId}`;
    QRCode.toDataURL(deslindeUrl, {
      width: 256,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((qrUrl) => {
        if (active) setQrDataUrl(qrUrl);
      })
      .catch((err: unknown) => {
        if (process.env.NODE_ENV !== 'test') {
          console.error(err);
        }
        if (active) setQrFallo(true);
      });
    return () => {
      active = false;
    };
  }, [reserva, reservaId]);

  const error = errorReserva ?? (qrFallo ? 'No se pudo cargar la información del voucher.' : null);

  const handleDownloadPdf = useCallback(async () => {
    if (!reserva || downloadingPdf) return;
    try {
      setDownloadingPdf(true);
      const publicId = reserva.tokenPublico || reserva.shortId || reservaId || '';
      const res = await axios.get(`${apiUrl}/public/voucher/${publicId}/pdf`, { responseType: 'blob' });
      const isJson = (res.headers as unknown as Record<string, string>)?.['content-type']?.includes('application/json');
      if (isJson) {
        window.print();
        return;
      }
      const blob: Blob = res.data instanceof Blob ? res.data : new Blob([res.data as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voucher_${reserva.numeroReserva || publicId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  }, [reserva, downloadingPdf, apiUrl, reservaId]);

  const handleShare = useCallback(async () => {
    if (!reserva) return;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = `Ticket de Vuelo #${reserva.numeroReserva || reserva.shortId} - ${nombreEscuela}`;
    const text = `¡Hola! Aquí tienes el Ticket de Vuelo / Boarding Pass de tu reserva #${reserva.numeroReserva || reserva.shortId}:\n${url}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado al portapapeles — pégalo donde quieras compartirlo');
        return;
      } catch {
        // cae a WhatsApp
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }, [reserva, nombreEscuela]);

  const handleAddToCalendar = useCallback(() => {
    if (!reserva) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const publicId = reserva.tokenPublico || reserva.shortId || reservaId;
    const icsUrl = `${origin}/api/public/calendar/reserva/${publicId}.ics`;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = icsUrl;
  }, [reserva, reservaId]);

  const handleGoogleCalendar1Click = useCallback(() => {
    if (!reserva) return;
    const title = `🪂 Vuelo en Parapente - Reserva #${reserva.numeroReserva || reserva.shortId}`;
    const details = `¡Experiencia de Vuelo ${nombreEscuela}!\nTitular: ${reserva.nombreTitular}\nPasajeros: ${reserva.pasajeros?.length ?? 0}`;
    const location = puntoDeEncuentro || `Pista de Despegue ${nombreEscuela}`;

    const googleUrl = buildGoogleCalendarUrl({
      title,
      fecha: reserva.fechaAgenda || new Date(),
      hora: reserva.horaAgenda || undefined,
      duracionMinutos: 60,
      details,
      location,
    });
    window.open(googleUrl, '_blank');
  }, [reserva, nombreEscuela, puntoDeEncuentro]);

  const saldoPendiente = Math.max(0, (reserva?.valorTotal || 0) - (reserva?.abono || 0));
  const fechaEfectiva = reserva?.fechaAgenda;
  const fechaFormateada = fechaEfectiva
    ? formatFechaEspanol(fechaEfectiva, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Por coordinar con la escuela';

  const publicIdentifier = reserva ? (reserva.tokenPublico || reserva.shortId || reservaId) : reservaId;

  return {
    reserva,
    loading,
    error,
    puntoDeEncuentro,
    qrDataUrl,
    downloadingPdf,
    saldoPendiente,
    fechaFormateada,
    publicIdentifier,
    handleDownloadPdf,
    handleShare,
    handleAddToCalendar,
    handleGoogleCalendar1Click,
  };
}
