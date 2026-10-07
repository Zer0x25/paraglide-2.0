"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMeteorologia } from '@/hooks/useMeteorologia';
import { 
  CreateCondicionPistaPayloadSchema, 
  CreateCondicionPistaPayload, 
  EstadoPista 
} from '@parapente/shared';
import { toast } from 'sonner';

export function useMeteorologiaController() {
  const {
    estadoActual,
    historial,
    loading,
    refetch,
    registrarCondicion,
    pronostico,
    pronosticoLoading,
    refrescarOpenMeteo,
    refrescando,
    proximoRefrescoTs,
  } = useMeteorologia();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cuenta atrás del cooldown de 5 min para el botón de pronóstico.
  // Date.now() es impuro en render; se lee en efecto/intervalo para respetar react-hooks/purity.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const enCooldown = refrescando || (proximoRefrescoTs != null && proximoRefrescoTs > ahora);
  const segundosRestantes = enCooldown && proximoRefrescoTs != null
    ? Math.max(0, Math.ceil((proximoRefrescoTs - ahora) / 1000))
    : 0;
  const minutosRestantes = Math.floor(segundosRestantes / 60);
  const labelCooldown = minutosRestantes > 0
    ? `${minutosRestantes}m ${segundosRestantes % 60}s`
    : `${segundosRestantes}s`;

  // --- Helpers de conversión de unidades (frontend, sin tocar el backend) ---
  const kmhAKt = (v: number | null) => (v == null ? null : v * 0.539957);
  const cAF = (c: number | null) => (c == null ? null : (c * 9) / 5 + 32);
  const mAPies = (m: number | null) => (m == null ? null : m * 3.28084);
  const dirEsAEn: Record<string, string> = {
    N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SO: 'SW', O: 'W', NO: 'NW',
  };
  const dirAEn = (d: string | null | undefined) =>
    d && dirEsAEn[d] ? dirEsAEn[d] : null;

  // Frescura del boletín: minutos desde la última lectura (null si no hay fecha).
  const minutosDesde = (valor: string | Date | null | undefined) => {
    if (valor == null) return null;
    const t = new Date(valor).getTime();
    if (Number.isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 60000);
  };

  const form = useForm<CreateCondicionPistaPayload>({
    resolver: zodResolver(CreateCondicionPistaPayloadSchema) as unknown as import('react-hook-form').Resolver<CreateCondicionPistaPayload>,
    defaultValues: {
      estadoPista: 'ABIERTA',
      velocidadViento: 14,
      rachaViento: 18,
      direccionViento: 'SO',
      temperatura: 22,
      visibilidad: 'EXCELENTE',
      techoNubes: 1800,
      observaciones: '',
      registradoPor: 'Director de Vuelo',
    },
  });

  const onSubmit = async (data: CreateCondicionPistaPayload) => {
    setIsSubmitting(true);
    try {
      await registrarCondicion(data);
      form.reset({
        estadoPista: data.estadoPista,
        velocidadViento: data.velocidadViento,
        rachaViento: data.rachaViento,
        direccionViento: data.direccionViento,
        temperatura: data.temperatura,
        visibilidad: data.visibilidad,
        techoNubes: data.techoNubes,
        observaciones: '',
        registradoPor: data.registradoPor,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cargarDatosActuales = () => {
    if (pronostico) {
      form.setValue('velocidadViento', pronostico.velocidadViento ?? undefined);
      form.setValue('rachaViento', pronostico.rachaViento ?? undefined);
      form.setValue('direccionViento', pronostico.direccionViento ?? '');
      form.setValue('temperatura', pronostico.temperatura ?? undefined);
      form.setValue('techoNubes', pronostico.techoNubes ?? undefined);
      form.setValue(
        'observaciones',
        `Pronóstico Open-Meteo: viento ${pronostico.velocidadViento} km/h, ${pronostico.direccionViento}`
      );
      toast.success('Campos cargados con el pronóstico Open-Meteo');
    } else {
      toast.error('No hay pronóstico disponible todavía');
    }
  };

  const handleQuickStatusChange = async (nuevoEstado: EstadoPista) => {
    try {
      await registrarCondicion({
        estadoPista: nuevoEstado,
        velocidadViento: estadoActual?.velocidadViento || 15,
        rachaViento: estadoActual?.rachaViento || 20,
        direccionViento: estadoActual?.direccionViento || 'SO',
        temperatura: estadoActual?.temperatura || 20,
        visibilidad: estadoActual?.visibilidad || 'EXCELENTE',
        techoNubes: estadoActual?.techoNubes || 1800,
        observaciones: `Cambio rápido de estado operacional a: ${nuevoEstado}`,
        registradoPor: 'Director de Vuelo',
      });
    } catch (err) {
      console.error(err);
    }
  };

  return {
    estadoActual,
    historial,
    loading,
    refetch,
    pronostico,
    pronosticoLoading,
    refrescarOpenMeteo,
    refrescando,
    enCooldown,
    labelCooldown,
    isSubmitting,
    form,
    onSubmit,
    cargarDatosActuales,
    handleQuickStatusChange,
    kmhAKt,
    cAF,
    mAPies,
    dirAEn,
    minutosDesde,
  };
}
