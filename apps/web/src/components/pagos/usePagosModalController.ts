"use client";

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { formatCLP } from '../../utils/format';
import { typedApiOutbox } from '../../services/apiOutbox';
import { isConflictError, isQueuedError } from '../../hooks/useDomainMutation';
import type { MetodoPago, EstadoPasajero, ReservaDTO } from '@parapente/shared';
import type { PagoItem, PendingPago } from './PagoFormSection';
import type { DevolucionItem, PendingDevolucion } from './DevolucionesSection';
import type { PasajeroRow } from './PasajerosVueloSection';

function getVueloFechaHora(reserva: ReservaConDetalles | null): Date | null {
  const vuelosFechas: Date[] = [];
  for (const p of (reserva?.pasajeros as unknown as { vuelos?: { fechaHora: string | Date; estado?: string }[] }[] | undefined) ?? []) {
    for (const v of p.vuelos ?? []) {
      if (!v?.fechaHora || v.estado === 'CANCELADO') continue;
      const d = new Date(v.fechaHora as string | Date);
      if (!isNaN(d.getTime())) vuelosFechas.push(d);
    }
  }
  if (vuelosFechas.length > 0) {
    vuelosFechas.sort((a, b) => a.getTime() - b.getTime());
    return vuelosFechas[0];
  }
  // fallback reserva fechaAgenda + horaAgenda
  const fa = reserva?.fechaAgenda as string | Date | undefined;
  const ha = reserva?.horaAgenda;
  if (fa && ha) {
    const fechaStr = typeof fa === 'string' ? fa.slice(0, 10) : new Date(fa).toISOString().slice(0, 10);
    const d = new Date(`${fechaStr}T${ha}:00`);
    if (!isNaN(d.getTime())) return d;
  }
  if (fa) {
    const d = new Date(fa as string | Date);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

interface ReservaConDetalles extends ReservaDTO {
  pasajeros?: PasajeroRow[];
  pagos?: PagoItem[];
  devoluciones?: DevolucionItem[];
  version?: number;
}

interface UsePagosModalControllerProps {
  reserva: ReservaConDetalles | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function usePagosModalController({
  reserva,
  onSuccess,
  onClose,
}: UsePagosModalControllerProps) {
  const [monto, setMonto] = useState<number | ''>('');
  const [pendingPagos, setPendingPagos] = useState<PendingPago[]>([]);
  const [deletingPagos, setDeletingPagos] = useState<number[]>([]);
  const metodoPorDefecto: MetodoPago = useMemo(() => {
    const persistidos = (reserva?.pagos as PagoItem[] | undefined)?.length ?? 0;
    const total = persistidos + pendingPagos.length;
    return total === 0 ? 'TRANSFERENCIA' : 'EFECTIVO';
  }, [reserva?.pagos, pendingPagos.length]);
  const [metodoPago, setMetodoPago] = useState<MetodoPago>(metodoPorDefecto);
  useEffect(() => {
    // Reset solo al cambiar de reserva: re-sincronizarlo con metodoPorDefecto en
    // cada paso (pendingPagos.length) pisaba el método elegido por el usuario.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMetodoPago(metodoPorDefecto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserva?.id]);
  const [comprobante, setComprobante] = useState('');
  const [notas, setNotas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [pendingDevoluciones, setPendingDevoluciones] = useState<PendingDevolucion[]>([]);
  const [deletingDevoluciones, setDeletingDevoluciones] = useState<number[]>([]);

  const [montoDevolucion, setMontoDevolucion] = useState<number | ''>('');
  const [metodoDevolucion, setMetodoDevolucion] = useState<MetodoPago>('TRANSFERENCIA');
  const [comprobanteDevolucion, setComprobanteDevolucion] = useState('');
  const [notasDevolucion, setNotasDevolucion] = useState('');

  const pasajeros: PasajeroRow[] = reserva?.pasajeros || [];

  const [estadoPasajeros, setEstadoPasajeros] = useState<Record<number, EstadoPasajero>>(() => {
    const inicial: Record<number, EstadoPasajero> = {};
    for (const p of pasajeros) {
      inicial[p.id] = p.estado === 'CANCELADO' ? 'CANCELADO' : p.estado === 'VUELO_COMPLETADO' ? 'VUELO_COMPLETADO' : 'POR_VOLAR';
    }
    return inicial;
  });

  const [vueloCompletado, setVueloCompletado] = useState<boolean>(() =>
    pasajeros.some((p) => p.estado && p.estado !== 'POR_VOLAR'),
  );

  const [estadoInicial] = useState<Record<number, EstadoPasajero>>(() => {
    const inicial: Record<number, EstadoPasajero> = {};
    for (const p of pasajeros) {
      inicial[p.id] = p.estado === 'CANCELADO' ? 'CANCELADO' : p.estado === 'VUELO_COMPLETADO' ? 'VUELO_COMPLETADO' : 'POR_VOLAR';
    }
    return inicial;
  });
  const [vueloCompletadoInicial] = useState<boolean>(() =>
    pasajeros.some((p) => p.estado && p.estado !== 'POR_VOLAR'),
  );

  const valorTotal = reserva?.valorTotal || 0;
  const abonoActual = reserva?.abono || 0;
  const saldoPendiente = Math.max(0, valorTotal - abonoActual);
  const porcentajePagado = valorTotal > 0 ? Math.min(100, Math.round((abonoActual / valorTotal) * 100)) : 0;
  const pagos: PagoItem[] = useMemo(() => reserva?.pagos ?? [], [reserva?.pagos]);
  const devoluciones: DevolucionItem[] = useMemo(() => reserva?.devoluciones ?? [], [reserva?.devoluciones]);
  
  const esFinalizadaOCancelada = reserva?.estado === 'CANCELADA' || reserva?.estado === 'COMPLETADA';
  const puedeDevolver =
    reserva?.estado === 'CANCELADA' || devoluciones.length > 0;
  // monto disponible para nuevas devoluciones (abono - devuelto activo - borradores pendientes)
  const montoDisponibleDevolucion = useMemo(() => {
    const activas = devoluciones
      .filter((d) => !deletingDevoluciones.includes(d.id))
      .reduce((s, d) => s + (Number(d.monto) || 0), 0);
    const borradores = pendingDevoluciones.reduce((s, d) => s + (Number(d.monto) || 0), 0);
    return Math.max(0, (abonoActual || 0) - activas - borradores);
  }, [devoluciones, deletingDevoluciones, pendingDevoluciones, abonoActual]);
  const tienePasajeros = pasajeros.length > 0;

  // --- Gating barra Deslizar para completar: saldo 0 + vuelo +15min ---
  const vueloFechaHora = useMemo(() => getVueloFechaHora(reserva), [reserva]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  const tieneHistorialPagos = valorTotal <= 0 || (pagos.length - deletingPagos.length + pendingPagos.length > 0);
  const estaPagado = saldoPendiente <= 0 && tieneHistorialPagos;
  const vueloHoraCumplida = useMemo(() => {
    if (!vueloFechaHora) return false;
    // eslint-disable-next-line react-hooks/purity -- Date.now es intencional: compara hora actual con vuelo+15min, re-evaluado por tick cada minuto
    return Date.now() >= vueloFechaHora.getTime() + 15 * 60 * 1000;
  // tick fuerza re-evaluación cada minuto
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vueloFechaHora, tick]);
  const puedeCompletar = !esFinalizadaOCancelada && tienePasajeros && estaPagado && !!vueloFechaHora && vueloHoraCumplida;
  const mostrarSlide = !esFinalizadaOCancelada && (puedeCompletar || vueloCompletado);
  const slideDisabledReason: string | null = (() => {
    if (esFinalizadaOCancelada) return 'Reserva finalizada o cancelada';
    if (!tienePasajeros) return 'Sin pasajeros asignados';
    if (saldoPendiente > 0) return `Saldo pendiente ${formatCLP(saldoPendiente)}`;
    if (!tieneHistorialPagos) return 'Registra el comprobante en el historial de pagos';
    if (!vueloFechaHora) return 'Sin fecha/hora de vuelo';
    if (!vueloHoraCumplida) {
      const hh = vueloFechaHora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      return `Disponible 15 min después del vuelo (${hh})`;
    }
    return null;
  })();
  const hayCambioPasajeros =
    vueloCompletado !== vueloCompletadoInicial ||
    JSON.stringify(estadoPasajeros) !== JSON.stringify(estadoInicial);
  const tieneCambios =
    pendingPagos.length > 0 ||
    deletingPagos.length > 0 ||
    pendingDevoluciones.length > 0 ||
    deletingDevoluciones.length > 0 ||
    hayCambioPasajeros;

  const handleAddPago = (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || Number(monto) <= 0) {
      toast.error('Por favor ingresa un monto válido mayor a 0');
      return;
    }

    setPendingPagos((prev) => [
      ...prev,
      {
        monto: Number(monto),
        metodoPago,
        comprobante: comprobante.trim() || null,
        notas: notas.trim() || null,
      },
    ]);
    toast.success('Abono agregado. Presiona Guardar para registrarlo 💰');
    setMonto('');
    setComprobante('');
    setNotas('');
  };

  const toggleDeletePago = (pagoId: number) => {
    setDeletingPagos((prev) =>
      prev.includes(pagoId) ? prev.filter((id) => id !== pagoId) : [...prev, pagoId],
    );
  };

  const handleAddDevolucion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!montoDevolucion || Number(montoDevolucion) <= 0) {
      toast.error('Por favor ingresa un monto válido mayor a 0');
      return;
    }

    const existentesActivas = devoluciones
      .filter((d) => !deletingDevoluciones.includes(d.id))
      .reduce((s, d) => s + (Number(d.monto) || 0), 0);
    const borradores = pendingDevoluciones.reduce((s, d) => s + d.monto, 0);
    const totalConNueva = existentesActivas + borradores + Number(montoDevolucion);
    if (totalConNueva > (reserva?.abono || 0)) {
      toast.error(`No se puede devolver más de lo pagado (abono: ${formatCLP(reserva?.abono || 0)})`);
      return;
    }

    setPendingDevoluciones((prev) => [
      ...prev,
      {
        monto: Number(montoDevolucion),
        metodoPago: metodoDevolucion,
        comprobante: comprobanteDevolucion.trim() || null,
        notas: notasDevolucion.trim() || null,
      },
    ]);
    toast.success('Devolución agregada. Presiona Guardar para registrarla 💸');
    setMontoDevolucion('');
    setComprobanteDevolucion('');
    setNotasDevolucion('');
  };

  const toggleDeleteDevolucion = (devolucionId: number) => {
    setDeletingDevoluciones((prev) =>
      prev.includes(devolucionId) ? prev.filter((id) => id !== devolucionId) : [...prev, devolucionId],
    );
  };

  const handleSave = async () => {
    if (!reserva || !reserva.id) return;
    setIsSubmitting(true);
    let versionActual = reserva.version ?? 0;
    let pagosPersistidos = 0;
    let eliminacionesPersistidas = 0;
    let devolucionesPersistidas = 0;
    let eliminacionesDevolucionesPersistidas = 0;
    // Paso/intento en curso: permite saber, ante un error encolado (offline),
    // qué operación ya quedó en el outbox y cuáles no llegaron a intentarse.
    let pasoFallo: 'pagos' | 'elimPagos' | 'estadoPax' | 'devoluciones' | 'elimDevoluciones' | null = null;
    try {
      // 1. Abonos pendientes
      pasoFallo = 'pagos';
      for (const pago of pendingPagos) {
        const updated = await typedApiOutbox.reservas.agregarPago(reserva.id, {
          monto: pago.monto,
          metodoPago: pago.metodoPago,
          comprobante: pago.comprobante,
          notas: pago.notas,
          version: versionActual,
        });
        versionActual = updated.version ?? versionActual;
        pagosPersistidos++;
      }

      // 2. Eliminaciones de pagos
      pasoFallo = 'elimPagos';
      for (const pagoId of deletingPagos) {
        const updated = await typedApiOutbox.reservas.eliminarPago(reserva.id, pagoId, versionActual);
        versionActual = updated.version ?? versionActual;
        eliminacionesPersistidas++;
      }

      // 2b. Vuelo completado: pasajeros
      if (vueloCompletado) {
        pasoFallo = 'estadoPax';
        // La respuesta incrementa `version` en la API: propagarla o los pasos
        // 3/4 enviarían una versión obsoleta y recibirían un 409 espurio.
        const updated = await typedApiOutbox.reservas.actualizarEstadoPasajeros(reserva.id, {
          version: versionActual,
          pasajeros: Object.entries(estadoPasajeros).map(([id, estado]) => ({
            id: Number(id),
            estado: estado === 'CANCELADO' ? 'CANCELADO' : 'VUELO_COMPLETADO',
          })),
        });
        versionActual = updated.version ?? versionActual;
      }

      // 3. Devoluciones pendientes
      pasoFallo = 'devoluciones';
      for (const devolucion of pendingDevoluciones) {
        const updated = await typedApiOutbox.reservas.crearDevolucion(reserva.id, {
          monto: devolucion.monto,
          metodoPago: devolucion.metodoPago,
          comprobante: devolucion.comprobante,
          notas: devolucion.notas,
          version: versionActual,
        });
        versionActual = updated.version ?? versionActual;
        devolucionesPersistidas++;
      }

      // 4. Eliminaciones de devoluciones
      pasoFallo = 'elimDevoluciones';
      for (const devolucionId of deletingDevoluciones) {
        const updated = await typedApiOutbox.reservas.eliminarDevolucion(reserva.id, devolucionId, versionActual);
        versionActual = updated.version ?? versionActual;
        eliminacionesDevolucionesPersistidas++;
      }

      toast.success('Cambios guardados con éxito ✅');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error(error);
      if (isQueuedError(error) || (error as { queued?: boolean })?.queued) {
        // ADR 009: la operación que falló YA quedó en el outbox (se enviará al
        // reconectar). Conservar como pendiente solo lo que aún no se intentó,
        // para que un nuevo "Guardar" no lo encole dos veces.
        setPendingPagos((prev) => prev.slice(pagosPersistidos + (pasoFallo === 'pagos' ? 1 : 0)));
        setDeletingPagos((prev) => prev.slice(eliminacionesPersistidas + (pasoFallo === 'elimPagos' ? 1 : 0)));
        setPendingDevoluciones((prev) => prev.slice(devolucionesPersistidas + (pasoFallo === 'devoluciones' ? 1 : 0)));
        setDeletingDevoluciones((prev) => prev.slice(eliminacionesDevolucionesPersistidas + (pasoFallo === 'elimDevoluciones' ? 1 : 0)));
        toast.info('Sin conexión: los cambios se enviarán automáticamente al reconectar');
        onSuccess();
        onClose();
        return;
      }
      if (pagosPersistidos > 0 || eliminacionesPersistidas > 0 || devolucionesPersistidas > 0 || eliminacionesDevolucionesPersistidas > 0) {
        setPendingPagos((prev) => prev.slice(pagosPersistidos));
        setDeletingPagos((prev) => prev.slice(eliminacionesPersistidas));
        setPendingDevoluciones((prev) => prev.slice(devolucionesPersistidas));
        setDeletingDevoluciones((prev) => prev.slice(eliminacionesDevolucionesPersistidas));
      }
      if (isConflictError(error)) {
        toast.error('La reserva cambió en otro dispositivo. Recargando...');
        onSuccess();
      } else {
        const errorMsg = (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Error al guardar los cambios';
        toast.error(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    monto,
    setMonto,
    metodoPago,
    setMetodoPago,
    comprobante,
    setComprobante,
    notas,
    setNotas,
    isSubmitting,
    pendingPagos,
    setPendingPagos,
    deletingPagos,
    pendingDevoluciones,
    setPendingDevoluciones,
    deletingDevoluciones,
    montoDevolucion,
    setMontoDevolucion,
    metodoDevolucion,
    setMetodoDevolucion,
    comprobanteDevolucion,
    setComprobanteDevolucion,
    notasDevolucion,
    setNotasDevolucion,
    pasajeros,
    estadoPasajeros,
    setEstadoPasajeros,
    vueloCompletado,
    setVueloCompletado,
    valorTotal,
    abonoActual,
    saldoPendiente,
    porcentajePagado,
    pagos,
    devoluciones,
    esFinalizadaOCancelada,
    puedeDevolver,
    montoDisponibleDevolucion,
    tienePasajeros,
    tieneCambios,
    // gating slide
    vueloFechaHora,
    vueloHoraCumplida,
    estaPagado,
    puedeCompletar,
    mostrarSlide,
    slideDisabledReason,
    handleAddPago,
    toggleDeletePago,
    handleAddDevolucion,
    toggleDeleteDevolucion,
    handleSave,
  };
}
