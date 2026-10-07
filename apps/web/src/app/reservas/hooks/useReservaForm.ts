import { useState } from 'react';
import { useForm, useFieldArray, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CreateReservaPayloadSchema,
  type CreateReservaPayload,
  type UpdateReservaPayload,
  derivarEstadoPago,
  type ResolucionDiaDTO,
  type ReglaOperativaDTO,
  type TarifaDTO,
  type PromocionDTO,
  dateKeyLocal,
} from '@parapente/shared';
import type { ReservaConPasajeros, PasajeroConVuelos } from '@/types/reservaDetalle';
import { isConflictError, isQueuedError } from '../../../hooks/useDomainMutation';
import { formatCLP } from '../../../utils/format';
import typedApi from '../../../services/api';
import { getApiErrorMessage, type ApiErrorWithResponse } from './useReservasModals';

interface UseReservaFormParams {
  createReserva: (data: CreateReservaPayload) => Promise<unknown>;
  updateReserva: (id: number, data: UpdateReservaPayload) => Promise<unknown>;
  fetchReservas: () => void;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  editingVersion: number;
  setEditingVersion: (v: number) => void;
  setIsModalOpen: (open: boolean) => void;
  setSelectedReservaPagos: (r: ReservaConPasajeros) => void;
  setIsPagosModalOpen: (open: boolean) => void;
}

export function useReservaForm({
  createReserva,
  updateReserva,
  fetchReservas,
  editingId,
  setEditingId,
  editingVersion,
  setEditingVersion,
  setIsModalOpen,
  setSelectedReservaPagos,
  setIsPagosModalOpen,
}: UseReservaFormParams) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<CreateReservaPayload>({
    resolver: zodResolver(CreateReservaPayloadSchema) as unknown as Resolver<CreateReservaPayload>,
    defaultValues: {
      nombreTitular: '',
      rutDniTitular: '',
      telefono: '',
      email: '',
      esGiftCard: false,
      fechaAgenda: null,
      horaAgenda: null,
      estadoPago: 'PENDIENTE',
      valorTotal: 0,
      abono: 0,
      pasajeros: [
        {
          nombre: '',
          rutDni: '',
          peso: null,
          telefono: '',
          contactoEmergencia: '',
          telefonoEmergencia: '',
          condicionFisica: '',
          estado: 'POR_VOLAR',
          firmaDeslinde: false,
        },
      ],
    },
  });

  const { fields: pasajerosFields, append, remove } = useFieldArray({
    control,
    name: 'pasajeros',
  });

  // Watch values for auto-calculations
  const valorTotal = watch('valorTotal') || 0;
  const abono = watch('abono') || 0;

  // Giftcard / sin fecha: reservas abiertas por coordinar (sin fechaReserva)
  const [esSinFecha, setEsSinFecha] = useState(false);

  // Tarifas y promociones del catálogo
  const [tarifaSeleccionada, setTarifaSeleccionada] = useState<number | ''>('');
  const [promoSeleccionada, setPromoSeleccionada] = useState<number | ''>('');
  const [detalleCalculo, setDetalleCalculo] = useState<string | null>(null);

  const tarifasQuery = useQuery({
    queryKey: ['tarifas'],
    queryFn: () => typedApi.tarifas.listar(),
    staleTime: 60_000,
  });
  const promocionesQuery = useQuery({
    queryKey: ['promociones'],
    queryFn: () => typedApi.promociones.listar(),
    staleTime: 60_000,
  });
  const hoyISO = dateKeyLocal();
  const tarifasActivas = (tarifasQuery.data?.data ?? []).filter((t: TarifaDTO) => t.activo);

  const fechaReferencial = '';
  const bloquesDelDia: ResolucionDiaDTO['horarios'] = [];

  const reglasQuery = useQuery<ReglaOperativaDTO[]>({
    queryKey: ['reglas-operativas'],
    queryFn: () => typedApi.reglasOperativas.listar(),
    staleTime: 60_000,
  });
  const puntoDeEncuentro =
    reglasQuery.data?.find((r: ReglaOperativaDTO) => r.categoria === 'PUNTO_ENCUENTRO' && r.esDefault)?.valor ||
    reglasQuery.data?.find((r: ReglaOperativaDTO) => r.clave === 'puntoDeEncuentro')?.valor ||
    'Zona de Despegue';

  const promosVigentes = (promocionesQuery.data?.data ?? []).filter((p: PromocionDTO) => {
    if (!p.activa) return false;
    const inicioKey = p.fechaInicio ? String(p.fechaInicio).slice(0, 10) : '';
    const finKey = p.fechaFin ? String(p.fechaFin).slice(0, 10) : '';
    if (inicioKey && inicioKey > hoyISO) return false;
    if (finKey && finKey < hoyISO) return false;
    return true;
  });

  const calcularValor = async (
    tarifaId: number | '',
    promocionId: number | '',
    cantidadOverride?: number
  ) => {
    setDetalleCalculo(null);
    if (!tarifaId) return;
    const cantidad = cantidadOverride ?? Math.max(1, pasajerosFields.length);
    try {
      const res = await typedApi.reservas.calcularValor({
        tarifaId,
        ...(promocionId ? { promocionId } : {}),
        cantidadPasajeros: cantidad,
      });
      setValue('valorTotal', res.valorTotal, { shouldValidate: true, shouldDirty: true });
      setDetalleCalculo(res.detalle);
      toast.info(`Valor calculado: ${formatCLP(res.valorTotal)} (${res.detalle})`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo calcular el valor con esa tarifa/promoción.'));
    }
  };

  const handleOpenModal = () => {
    setEditingId(null);
    setEditingVersion(0);
    setEsSinFecha(false);
    setTarifaSeleccionada('');
    setPromoSeleccionada('');
    setDetalleCalculo(null);
    reset({
      nombreTitular: '',
      rutDniTitular: '',
      telefono: '',
      email: '',
      esGiftCard: false,
      fechaAgenda: null,
      horaAgenda: null,
      estadoPago: 'PENDIENTE',
      valorTotal: 0,
      abono: 0,
      pasajeros: [
        {
          nombre: '',
          rutDni: '',
          peso: null,
          telefono: '',
          contactoEmergencia: '',
          telefonoEmergencia: '',
          condicionFisica: '',
        },
      ],
    });
    setIsModalOpen(true);
  };

  const handleEditModal = (reserva: ReservaConPasajeros) => {
    const estado = reserva.estado ?? 'SIN_AGENDAR';
    if (estado === 'CANCELADA' || estado === 'COMPLETADA') {
      toast.error('No se puede editar una reserva cancelada o completada.');
      return;
    }
    setEditingId(reserva.id as number);
    setEditingVersion(reserva.version ?? 0);
    setTarifaSeleccionada((reserva as unknown as { tarifaId?: number | null }).tarifaId ?? '');
    setPromoSeleccionada((reserva as unknown as { promocionId?: number | null }).promocionId ?? '');
    setDetalleCalculo(null);
    reset({
      nombreTitular: reserva.nombreTitular,
      rutDniTitular: reserva.rutDniTitular || '',
      telefono: reserva.telefono || '',
      email: reserva.email || '',
      esGiftCard: Boolean(reserva.esGiftCard),
      fechaAgenda: reserva.fechaAgenda || null,
      horaAgenda: reserva.horaAgenda || null,
      estadoPago: reserva.estadoPago,
      valorTotal: reserva.valorTotal || 0,
      abono: reserva.abono || 0,
      pasajeros:
        reserva.pasajeros.length > 0
          ? reserva.pasajeros.map((p: PasajeroConVuelos) => ({
              id: p.id,
              nombre: p.nombre,
              rutDni: p.rutDni || '',
              peso: p.peso ? Number(p.peso) : null,
              telefono: p.telefono || '',
              contactoEmergencia: p.contactoEmergencia || '',
              telefonoEmergencia: p.telefonoEmergencia || '',
              condicionFisica: p.condicionFisica || '',
              firmaDeslinde: Boolean(p.firmaDeslinde),
            }))
          : [
              {
                nombre: '',
                rutDni: '',
                peso: null,
                telefono: '',
                contactoEmergencia: '',
                telefonoEmergencia: '',
                condicionFisica: '',
                firmaDeslinde: false,
              },
            ],
    });
    setIsModalOpen(true);
  };

  const copiarDatosTitular = () => {
    // eslint-disable-next-line react-hooks/incompatible-library -- watch() no es memoizable; uso intencional
    const nombreTitular = watch('nombreTitular');
    const rutTitular = watch('rutDniTitular');
    const telefonoTitular = watch('telefono');
    setValue(`pasajeros.0.nombre`, nombreTitular || '', { shouldValidate: true, shouldDirty: true });
    setValue(`pasajeros.0.rutDni`, rutTitular || '', { shouldDirty: true });
    setValue(`pasajeros.0.telefono`, telefonoTitular || '', { shouldDirty: true });
  };

  const onInvalid = (fieldErrors: FieldErrors<CreateReservaPayload>) => {
    console.warn('Errores de validación en formulario de reserva:', fieldErrors);
    if (fieldErrors.nombreTitular?.message) {
      toast.error(`Titular: ${String(fieldErrors.nombreTitular.message)}`);
      return;
    }
    if (fieldErrors.email?.message) {
      toast.error(`Email: ${String(fieldErrors.email.message)}`);
      return;
    }
    if (fieldErrors.valorTotal?.message) {
      toast.error(`Valor total: ${String(fieldErrors.valorTotal.message)}`);
      return;
    }
    if (fieldErrors.pasajeros) {
      const pErrors = Array.isArray(fieldErrors.pasajeros)
        ? fieldErrors.pasajeros
        : Object.values(fieldErrors.pasajeros as Record<string, unknown>);
      for (let i = 0; i < pErrors.length; i++) {
        const pErr = pErrors[i] as FieldErrors<NonNullable<CreateReservaPayload['pasajeros']>[number]>;
        if (pErr?.nombre?.message) {
          toast.error(`Pasajero ${i + 1}: ${String(pErr.nombre.message)}`);
          return;
        }
        if (pErr?.peso?.message) {
          toast.error(`Pasajero ${i + 1}: ${String(pErr.peso.message)}`);
          return;
        }
      }
    }
    toast.error('Por favor completa todos los campos requeridos marcados en rojo.');
  };

  const onSubmit = async (data: CreateReservaPayload) => {
    // Solo la creación envía importes derivados; en edición no viajan (punto 3).
    if (!editingId) {
      data.estadoPago = derivarEstadoPago(data.valorTotal || 0, data.abono || 0);
    }

    if (data.email === '') data.email = null;
    if (data.rutDniTitular === '') data.rutDniTitular = null;
    if (data.telefono === '') data.telefono = null;

    data.esGiftCard = Boolean(data.esGiftCard);

    if (data.pasajeros) {
      data.pasajeros = data.pasajeros.map((p) => ({
        ...p,
        ...(p.id !== undefined && p.id !== null ? { id: Number(p.id) } : {}),
        rutDni: p.rutDni || null,
        telefono: p.telefono || null,
        contactoEmergencia: p.contactoEmergencia || null,
        telefonoEmergencia: p.telefonoEmergencia || null,
        condicionFisica: p.condicionFisica || null,
        peso: p.peso ? Number(p.peso) : null,
        firmaDeslinde: Boolean(p.firmaDeslinde),
      }));
    }

    if (typeof tarifaSeleccionada === 'number') {
      data.tarifaId = tarifaSeleccionada;
      data.promocionId = typeof promoSeleccionada === 'number' ? promoSeleccionada : null;
    } else if (editingId && tarifaSeleccionada === '') {
      data.tarifaId = null;
      data.promocionId = null;
    }

    try {
      if (editingId) {
        // Punto 3: abono/montoDevuelto/estadoPago son importes derivados (pagos y
        // devoluciones). La edición de la reserva no los envía: el servidor los
        // re-deriva y así el invariante abono == suma(pagos activos) es estructural.
        const edicion = { ...data, version: editingVersion } as Record<string, unknown>;
        delete edicion.abono;
        delete edicion.montoDevuelto;
        delete edicion.estadoPago;
        await updateReserva(editingId, edicion as unknown as UpdateReservaPayload);
        setIsModalOpen(false);
        toast.success('Reserva actualizada con éxito.');
      } else {
        const nueva = await createReserva(data);
        setIsModalOpen(false);
        toast.success('Reserva creada con éxito. Registra el pago para agilizar el agendamiento.');
        setSelectedReservaPagos(nueva as unknown as ReservaConPasajeros);
        setIsPagosModalOpen(true);
      }
    } catch (error: unknown) {
      if ((error as ApiErrorWithResponse)?.queued || isQueuedError(error as Error)) {
        setIsModalOpen(false);
        toast.info('Sin conexión: la reserva se guardó localmente y se enviará automáticamente al reconectar 🪂');
        return;
      }
      console.error('Error guardando reserva:', error);
      if (isConflictError(error as Error)) {
        toast.error('La reserva cambió en otro dispositivo. Recargando...');
        fetchReservas();
      } else {
        toast.error(getApiErrorMessage(error, 'Error al guardar la reserva.'));
      }
    }
  };

  return {
    register,
    handleSubmit,
    errors,
    isDirty,
    setValue,
    pasajerosFields,
    append,
    remove,
    valorTotal,
    abono,
    esSinFecha,
    setEsSinFecha,
    tarifaSeleccionada,
    setTarifaSeleccionada,
    promoSeleccionada,
    setPromoSeleccionada,
    detalleCalculo,
    puntoDeEncuentro,
    tarifasActivas,
    promosVigentes,
    bloquesDelDia,
    fechaReferencial,
    calcularValor,
    copiarDatosTitular,
    handleOpenModal,
    handleEditModal,
    onSubmit,
    onInvalid,
  };
}
