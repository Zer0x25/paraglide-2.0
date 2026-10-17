'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dateKeyLocal,
  fechaHoraLocalToIso,
  horaLocalHHMM,
  type ActualizarEstadoPasajerosPayload,
  type EstadoPasajero,
  type ReservaDTO,
} from '@parapente/shared';
import { toast } from 'sonner';
import { isQueuedError, useDomainMutation } from '@/hooks/useDomainMutation';
import api from '@/services/api';
import { typedApiOutbox } from '@/services/apiOutbox';
import type { FiltroMarcacion, MarcacionRow, ReservaMarcacion } from '../types';

interface GuardarMarcacionVariables {
  reservaId: number;
  version: number;
  pasajeros: ActualizarEstadoPasajerosPayload['pasajeros'];
  selectedKey: string;
}

const normalizarEstado = (estado?: EstadoPasajero | null): EstadoPasajero =>
  estado === 'CANCELADO' || estado === 'VUELO_COMPLETADO' ? estado : 'POR_VOLAR';

function moverFecha(fecha: string, dias: number): string {
  const [year, month, day] = fecha.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + dias, 12));
  return shifted.toISOString().slice(0, 10);
}

export function useMarcacionController(autorizado = true) {
  const queryClient = useQueryClient();
  const [fecha, setFecha] = useState(() => dateKeyLocal(new Date()));
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroMarcacion>('TODOS');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Record<number, Record<number, EstadoPasajero>>>({});
  const [reservasEnCola, setReservasEnCola] = useState<Record<number, boolean>>({});

  const queryKey = ['reservas', 'marcacion', fecha] as const;
  const reservasQuery = useQuery<ReservaMarcacion[]>({
    queryKey,
    queryFn: async () => {
      const respuesta = await api.reservas.listar({
        desde: fechaHoraLocalToIso(fecha, '00:00'),
        pageSize: 500,
        sort: 'fechaAgenda.asc',
      });
      return respuesta.data as unknown as ReservaMarcacion[];
    },
    initialData: autorizado
      ? () => queryClient.getQueryData<ReservaMarcacion[]>(['reservas'])
      : undefined,
    initialDataUpdatedAt: autorizado
      ? () => queryClient.getQueryState(['reservas'])?.dataUpdatedAt
      : undefined,
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: autorizado,
  });

  const filasDelDia = useMemo(() => {
    const filas: MarcacionRow[] = [];

    for (const reserva of reservasQuery.data ?? []) {
      for (const pasajero of reserva.pasajeros ?? []) {
        const vuelosDia = (pasajero.vuelos ?? [])
          .filter((vuelo) => dateKeyLocal(vuelo.fechaHora) === fecha)
          .sort((a, b) => new Date(a.fechaHora).getTime() - new Date(b.fechaHora).getTime());

        if (vuelosDia.length === 0) continue;
        const vueloPrincipal =
          vuelosDia.find((vuelo) => vuelo.estado !== 'CANCELADO') ?? vuelosDia[0];

        const borrador = borradores[reserva.id]?.[pasajero.id];
        const estado = borrador ?? normalizarEstado(pasajero.estado);
        filas.push({
          key: `${reserva.id}:${pasajero.id}`,
          reserva,
          pasajero,
          vuelo: vueloPrincipal,
          vuelosDia,
          estado,
          tieneCambio: borrador !== undefined,
        });
      }
    }

    return filas.sort((a, b) => {
      const hora = new Date(a.vuelo.fechaHora).getTime() - new Date(b.vuelo.fechaHora).getTime();
      if (hora !== 0) return hora;
      return a.pasajero.nombre.localeCompare(b.pasajero.nombre, 'es-CL');
    });
  }, [reservasQuery.data, borradores, fecha]);

  const filasFiltradas = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es-CL');

    return filasDelDia.filter((fila) => {
      if (filtro === 'PENDIENTES' && fila.estado !== 'POR_VOLAR') return false;
      if (filtro === 'VOLADOS' && fila.estado !== 'VUELO_COMPLETADO') return false;
      if (filtro === 'NO_VOLARON' && fila.estado !== 'CANCELADO') return false;
      if (!termino) return true;

      const texto = [
        fila.pasajero.nombre,
        fila.pasajero.rutDni,
        fila.reserva.nombreTitular,
        fila.reserva.numeroReserva,
        fila.vuelo.piloto?.nombre,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es-CL');

      return texto.includes(termino);
    });
  }, [filasDelDia, busqueda, filtro]);

  const filaSeleccionada =
    filasFiltradas.find((fila) => fila.key === selectedKey) ?? filasFiltradas[0] ?? null;

  const mutacion = useDomainMutation<ReservaDTO, GuardarMarcacionVariables>({
    mutationFn: ({ reservaId, version, pasajeros }) =>
      typedApiOutbox.reservas.actualizarEstadoPasajeros(reservaId, { version, pasajeros }),
    invalidateKeys: [['reservas'], ['vuelos']],
    successMessage: null,
    onSuccess: (actualizada, variables) => {
      const estadosActualizados = new Map(
        variables.pasajeros.map((pasajero) => [pasajero.id, pasajero.estado]),
      );
      const respuestaConPasajeros = actualizada as ReservaDTO & {
        pasajeros?: Array<{ id: number; estado: EstadoPasajero }>;
      };
      const estadosServidor = new Map(
        (respuestaConPasajeros.pasajeros ?? []).map((pasajero) => [pasajero.id, pasajero.estado]),
      );

      queryClient.setQueryData<ReservaMarcacion[]>(queryKey, (actuales) =>
        actuales?.map((reserva) =>
          reserva.id !== variables.reservaId
            ? reserva
            : {
                ...reserva,
                version: actualizada.version,
                estado: actualizada.estado,
                estadoPago: actualizada.estadoPago,
                abono: actualizada.abono,
                montoDevuelto: actualizada.montoDevuelto,
                updatedAt: actualizada.updatedAt,
                pasajeros: reserva.pasajeros?.map((pasajero) => ({
                  ...pasajero,
                  estado:
                    estadosActualizados.get(pasajero.id) ??
                    estadosServidor.get(pasajero.id) ??
                    pasajero.estado,
                })),
              },
        ),
      );

      setBorradores((actuales) => {
        const siguiente = { ...actuales };
        delete siguiente[variables.reservaId];
        return siguiente;
      });
      setReservasEnCola((actuales) => {
        const siguientes = { ...actuales };
        delete siguientes[variables.reservaId];
        return siguientes;
      });
      toast.success('Marcación guardada.');

      const indice = filasFiltradas.findIndex((fila) => fila.key === variables.selectedKey);
      const ordenCircular = [
        ...filasFiltradas.slice(indice + 1),
        ...filasFiltradas.slice(0, Math.max(indice, 0)),
      ];
      const siguientePendiente = ordenCircular.find(
        (fila) => fila.estado === 'POR_VOLAR' && !reservasEnCola[fila.reserva.id],
      );
      if (siguientePendiente) setSelectedKey(siguientePendiente.key);
    },
    onError: (error, variables) => {
      if (!isQueuedError(error)) return;
      setReservasEnCola((actuales) => ({ ...actuales, [variables.reservaId]: true }));
      toast.info('Sin conexión: la marcación quedó en cola y se enviará al reconectar.');
    },
  });

  const cambiarEstadoBorrador = (fila: MarcacionRow, estado: EstadoPasajero) => {
    setBorradores((actuales) => {
      const reservaBorradores = { ...(actuales[fila.reserva.id] ?? {}) };
      const estadoOriginal = normalizarEstado(fila.pasajero.estado);

      if (estado === estadoOriginal) {
        delete reservaBorradores[fila.pasajero.id];
      } else {
        reservaBorradores[fila.pasajero.id] = estado;
      }

      const siguientes = { ...actuales };
      if (Object.keys(reservaBorradores).length === 0) {
        delete siguientes[fila.reserva.id];
      } else {
        siguientes[fila.reserva.id] = reservaBorradores;
      }
      return siguientes;
    });
  };

  const puedeEditar = (fila: MarcacionRow) => {
    if (mutacion.isPending || reservasEnCola[fila.reserva.id]) return false;
    if (fila.reserva.estado === 'CANCELADA' || fila.reserva.estado === 'COMPLETADA') return false;
    if (fila.reserva.cerradaAt || fila.vuelosDia.every((vuelo) => vuelo.estado === 'CANCELADO')) {
      return false;
    }
    if (typeof fila.reserva.version !== 'number') return false;
    return fila.estado === 'POR_VOLAR' || fila.tieneCambio;
  };

  const puedeMarcarNoVolado = (fila: MarcacionRow) =>
    puedeEditar(fila) && !fila.pasajero.vuelos?.some((vuelo) => vuelo.estado === 'COMPLETADO');

  const contarBorradores = (reservaId: number) => Object.keys(borradores[reservaId] ?? {}).length;

  const guardarMarcaciones = (reserva: ReservaMarcacion, selectedRowKey?: string) => {
    if (
      typeof reserva.id !== 'number' ||
      typeof reserva.version !== 'number' ||
      reserva.estado === 'CANCELADA' ||
      reserva.estado === 'COMPLETADA' ||
      reserva.cerradaAt
    ) {
      return;
    }

    const cambios = borradores[reserva.id] ?? {};
    const pasajerosConVueloCompletado = new Set(
      (reserva.pasajeros ?? [])
        .filter((pasajero) => pasajero.vuelos?.some((vuelo) => vuelo.estado === 'COMPLETADO'))
        .map((pasajero) => pasajero.id),
    );
    const intentaCancelarVueloCompletado = Object.entries(cambios).some(
      ([pasajeroId, estado]) =>
        estado === 'CANCELADO' && pasajerosConVueloCompletado.has(Number(pasajeroId)),
    );

    if (intentaCancelarVueloCompletado) {
      toast.error(
        'No se puede marcar “no voló” si alguna agenda del pasajero ya figura completada.',
      );
      return;
    }

    const pasajeros = (reserva.pasajeros ?? [])
      .filter((pasajero) => Number.isInteger(pasajero.id) && pasajero.id > 0)
      .map((pasajero) => ({
        id: pasajero.id,
        estado: cambios[pasajero.id] ?? normalizarEstado(pasajero.estado),
      }));

    if (pasajeros.length === 0 || Object.keys(cambios).length === 0) return;

    mutacion.mutate({
      reservaId: reserva.id,
      version: reserva.version,
      pasajeros,
      selectedKey: selectedRowKey ?? `${reserva.id}:${filaSeleccionada?.pasajero.id ?? ''}`,
    });
  };

  const resumen = useMemo(
    () => ({
      total: filasDelDia.length,
      pendientes: filasDelDia.filter((fila) => fila.estado === 'POR_VOLAR').length,
      volados: filasDelDia.filter((fila) => fila.estado === 'VUELO_COMPLETADO').length,
      noVolaron: filasDelDia.filter((fila) => fila.estado === 'CANCELADO').length,
      borradores: Object.values(borradores).reduce(
        (total, pasajeros) => total + Object.keys(pasajeros).length,
        0,
      ),
    }),
    [filasDelDia, borradores],
  );

  return {
    fecha,
    setFecha,
    hoy: dateKeyLocal(new Date()),
    moverFecha,
    busqueda,
    setBusqueda,
    filtro,
    setFiltro,
    filasDelDia,
    filasFiltradas,
    filaSeleccionada,
    setSelectedKey,
    resumen,
    reservasQuery,
    mutacion,
    cambiarEstadoBorrador,
    puedeEditar,
    puedeMarcarNoVolado,
    contarBorradores,
    reservasEnCola,
    guardarMarcaciones,
    normalizarEstado,
    horaLocalHHMM,
  };
}

export type MarcacionController = ReturnType<typeof useMarcacionController>;
