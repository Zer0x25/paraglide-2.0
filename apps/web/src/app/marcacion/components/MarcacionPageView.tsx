'use client';

import Link from 'next/link';
import {
  AlertCircle,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSignature,
  Phone,
  Plane,
  RefreshCw,
  Search,
  UserRound,
  Weight,
} from 'lucide-react';
import { formatFechaEspanol } from '@parapente/shared';
import { Badge, Button, Card, Input, Skeleton } from '@/components/ui';
import { formatCLP } from '@/utils/format';
import type { FiltroMarcacion, MarcacionRow } from '../types';
import type { MarcacionController } from '../hooks/useMarcacionController';

const filtros: {
  id: FiltroMarcacion;
  label: string;
  count: (c: MarcacionController['resumen']) => number;
}[] = [
  { id: 'TODOS', label: 'Todos', count: (c) => c.total },
  { id: 'PENDIENTES', label: 'Por marcar', count: (c) => c.pendientes },
  { id: 'VOLADOS', label: 'Volaron', count: (c) => c.volados },
  { id: 'NO_VOLARON', label: 'No volaron', count: (c) => c.noVolaron },
];

function EstadoBadge({ estado }: { estado: MarcacionRow['estado'] }) {
  if (estado === 'VUELO_COMPLETADO') {
    return (
      <Badge variant="green">
        <Check size={12} className="mr-1" />
        Voló
      </Badge>
    );
  }
  if (estado === 'CANCELADO') {
    return <Badge variant="red">No voló</Badge>;
  }
  return <Badge variant="amber">Pendiente</Badge>;
}

function PanelJornada({ c }: { c: MarcacionController }) {
  return (
    <Card className="space-y-5 rounded-3xl p-4 sm:p-5">
      <div className="flex items-center gap-2 text-slate-900 dark:text-white">
        <CalendarDays size={18} className="text-blue-600 dark:text-blue-400" />
        <h2 className="font-bold">Jornada</h2>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="fecha-marcacion"
          className="text-xs font-semibold text-slate-500 dark:text-slate-400"
        >
          Fecha de vuelo
        </label>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="md"
            className="min-w-10 px-2"
            aria-label="Día anterior"
            onClick={() => c.setFecha(c.moverFecha(c.fecha, -1))}
          >
            <ChevronLeft size={18} />
          </Button>
          <Input
            id="fecha-marcacion"
            type="date"
            value={c.fecha}
            onChange={(event) => {
              if (event.target.value) c.setFecha(event.target.value);
            }}
            className="min-w-0 rounded-xl"
          />
          <Button
            variant="ghost"
            size="md"
            className="min-w-10 px-2"
            aria-label="Día siguiente"
            onClick={() => c.setFecha(c.moverFecha(c.fecha, 1))}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        {c.fecha !== c.hoy && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => c.setFecha(c.hoy)}
            className="w-full rounded-xl"
          >
            Ir a hoy
          </Button>
        )}
        <p className="text-xs capitalize text-slate-500 dark:text-slate-400">
          {formatFechaEspanol(c.fecha, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="buscar-marcacion"
          className="text-xs font-semibold text-slate-500 dark:text-slate-400"
        >
          Buscar pasajero
        </label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            id="buscar-marcacion"
            value={c.busqueda}
            onChange={(event) => c.setBusqueda(event.target.value)}
            placeholder="Nombre, titular o piloto"
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</p>
        {filtros.map((opcion) => {
          const activo = c.filtro === opcion.id;
          return (
            <button
              key={opcion.id}
              type="button"
              aria-pressed={activo}
              onClick={() => c.setFiltro(opcion.id)}
              className={`flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                activo
                  ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span>{opcion.label}</span>
              <span className="text-xs tabular-nums">{opcion.count(c.resumen)}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600 dark:text-slate-300">Pendientes de guardar</span>
          <Badge variant={c.resumen.borradores > 0 ? 'amber' : 'gray'}>
            {c.resumen.borradores}
          </Badge>
        </div>
        {Object.values(c.reservasEnCola).some(Boolean) && (
          <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Hay marcaciones en cola esperando conexión.
          </p>
        )}
      </div>
    </Card>
  );
}

function ListaPasajeros({ c }: { c: MarcacionController }) {
  if (c.reservasQuery.isPending) {
    return (
      <div className="space-y-3" aria-label="Cargando pasajeros">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item} className="flex items-center gap-3 rounded-2xl p-4">
            <Skeleton className="h-10 w-14 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-56 max-w-full rounded" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (c.reservasQuery.isError && !c.reservasQuery.data) {
    const errorStatus = (c.reservasQuery.error as { response?: { status?: number } })?.response
      ?.status;
    const sinPermiso = errorStatus === 403;

    return (
      <Card className="rounded-3xl border-red-200 p-8 text-center dark:border-red-900">
        <AlertCircle size={28} className="mx-auto mb-3 text-red-500" />
        <h3 className="font-bold text-slate-900 dark:text-white">
          {sinPermiso ? 'Acceso restringido' : 'No se pudo cargar la jornada'}
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {sinPermiso
            ? 'La marcación está disponible para los perfiles de recepción y administración.'
            : 'Revisa la conexión e inténtalo de nuevo.'}
        </p>
        {!sinPermiso && (
          <Button
            variant="secondary"
            onClick={() => void c.reservasQuery.refetch()}
            className="mt-4 rounded-xl"
          >
            Reintentar
          </Button>
        )}
      </Card>
    );
  }

  if (c.filasDelDia.length === 0) {
    return (
      <Card className="rounded-3xl p-8 text-center sm:p-12">
        <Plane size={30} className="mx-auto mb-3 text-slate-400" />
        <h3 className="font-bold text-slate-900 dark:text-white">
          No hay vuelos agendados para esta fecha
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Al asignar pasajeros a un horario desde el calendario, aparecerán aquí para su marcación.
        </p>
        <Link
          href="/calendario"
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          Abrir calendario
        </Link>
      </Card>
    );
  }

  if (c.filasFiltradas.length === 0) {
    return (
      <Card className="rounded-3xl p-8 text-center">
        <Search size={24} className="mx-auto mb-3 text-slate-400" />
        <h3 className="font-bold text-slate-900 dark:text-white">Sin resultados</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Cambia el filtro o la búsqueda para ver otros pasajeros.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {c.filasFiltradas.map((fila) => {
        const activa = c.filaSeleccionada?.key === fila.key;
        return (
          <button
            key={fila.key}
            type="button"
            aria-pressed={activa}
            onClick={() => c.setSelectedKey(fila.key)}
            className={`w-full rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:p-4 ${
              activa
                ? 'border-blue-400 bg-blue-50 shadow-sm ring-1 ring-blue-400/40 dark:border-blue-700 dark:bg-blue-950/35'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800/70'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex min-w-14 flex-col items-center rounded-xl bg-slate-100 px-2 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Clock3 size={14} className="mb-0.5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-bold tabular-nums">
                  {c.horaLocalHHMM(fila.vuelo.fechaHora)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate font-bold text-slate-900 dark:text-white">
                    {fila.pasajero.nombre}
                  </span>
                  <EstadoBadge estado={fila.estado} />
                </div>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  Reserva #{fila.reserva.numeroReserva ?? fila.reserva.id}
                  <span aria-hidden="true"> · </span>
                  {fila.reserva.nombreTitular}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <UserRound size={13} />
                    {fila.vuelo.piloto?.nombre ?? 'Piloto pendiente'}
                  </span>
                  {fila.vuelosDia.length > 1 && (
                    <span>{fila.vuelosDia.length} agendas ese día</span>
                  )}
                  {fila.tieneCambio && (
                    <Badge variant="amber" className="py-0">
                      {c.reservasEnCola[fila.reserva.id] ? 'En cola' : 'Sin guardar'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PanelDetalle({ c, fila }: { c: MarcacionController; fila: MarcacionRow | null }) {
  if (!fila) {
    return (
      <Card className="rounded-3xl p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Selecciona un pasajero para ver su ficha.
      </Card>
    );
  }

  const numeroReserva = fila.reserva.numeroReserva ?? fila.reserva.id;
  const cantidadBorradores = c.contarBorradores(fila.reserva.id);
  const estadoOriginal = c.normalizarEstado(fila.pasajero.estado);
  const estadoYaGuardado = !fila.tieneCambio && estadoOriginal !== 'POR_VOLAR';
  const reservaFinalizada =
    fila.reserva.estado === 'CANCELADA' || fila.reserva.estado === 'COMPLETADA';
  const agendaAnulada = fila.vuelosDia.every((vuelo) => vuelo.estado === 'CANCELADO');
  const agendaCompletada = fila.pasajero.vuelos?.some((vuelo) => vuelo.estado === 'COMPLETADO');
  const enCola = Boolean(c.reservasEnCola[fila.reserva.id]);

  return (
    <Card className="space-y-5 rounded-3xl p-4 sm:p-5 xl:sticky xl:top-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Ficha del pasajero
            </p>
            <h2 className="mt-1 break-words text-xl font-black text-slate-900 dark:text-white">
              {fila.pasajero.nombre}
            </h2>
          </div>
          <EstadoBadge estado={fila.estado} />
        </div>
        {fila.tieneCambio && (
          <Badge variant="amber" className="mt-2">
            {enCola ? 'Pendiente de sincronizar' : 'Marcación sin guardar'}
          </Badge>
        )}
      </div>

      <div className="space-y-3 border-y border-slate-100 py-4 dark:border-slate-700/70">
        <div className="flex items-start gap-3">
          <UserRound size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {fila.reserva.nombreTitular}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Titular · Reserva #{numeroReserva}
            </p>
          </div>
        </div>
        {(fila.pasajero.telefono || fila.reserva.telefono) && (
          <a
            href={`tel:${fila.pasajero.telefono ?? fila.reserva.telefono}`}
            className="flex min-h-9 items-center gap-3 rounded-xl text-sm text-blue-700 hover:underline dark:text-blue-300"
          >
            <Phone size={16} className="shrink-0 text-slate-400" />
            {fila.pasajero.telefono ?? fila.reserva.telefono}
          </a>
        )}
        <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
          <Clock3 size={16} className="shrink-0 text-slate-400" />
          {c.horaLocalHHMM(fila.vuelo.fechaHora)}
          {fila.vuelosDia.length > 1 && ` · ${fila.vuelosDia.length} vuelos agendados`}
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
          <Plane size={16} className="shrink-0 text-slate-400" />
          {fila.vuelo.piloto?.nombre ?? 'Piloto pendiente'}
        </div>
        {(fila.pasajero.pesoVerificado || fila.pasajero.peso) && (
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <Weight size={16} className="shrink-0 text-slate-400" />
            {fila.pasajero.pesoVerificado ?? fila.pasajero.peso} kg
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Deslinde
          </p>
          <p
            className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${fila.pasajero.firmaDeslinde ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}
          >
            {fila.pasajero.firmaDeslinde ? <BadgeCheck size={15} /> : <FileSignature size={15} />}
            {fila.pasajero.firmaDeslinde ? 'Firmado' : 'Pendiente'}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/50">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pago</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {fila.reserva.estadoPago}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatCLP(fila.reserva.abono)}
          </p>
        </div>
      </div>

      {!fila.pasajero.firmaDeslinde && (
        <p className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          El deslinde todavía no aparece firmado. Confírmalo antes del despegue.
        </p>
      )}

      <div className="space-y-3" aria-label="Acciones de marcación">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white">Marcación del vuelo</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Registra el resultado y guarda los cambios de esta reserva.
          </p>
        </div>

        {enCola ? (
          <p className="rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            La marcación está en la cola sin conexión. Espera a que se sincronice antes de cambiar
            otros pasajeros de esta reserva.
          </p>
        ) : reservaFinalizada ? (
          <p className="rounded-2xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            La reserva está finalizada y ya no admite cambios de marcación.
          </p>
        ) : fila.reserva.cerradaAt ? (
          <p className="rounded-2xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            La reserva está cerrada contablemente y no admite cambios.
          </p>
        ) : agendaAnulada ? (
          <p className="rounded-2xl bg-red-50 p-3 text-xs leading-relaxed text-red-800 dark:bg-red-950/40 dark:text-red-200">
            Esta agenda está anulada. Revisa el calendario antes de marcar el resultado.
          </p>
        ) : estadoYaGuardado ? (
          <p className="rounded-2xl bg-slate-100 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            El resultado ya está guardado. Si necesitas corregirlo, abre la reserva desde el
            calendario.
          </p>
        ) : (
          <div className="space-y-2">
            {agendaCompletada && (
              <p className="rounded-2xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                Una de las agendas de este pasajero ya figura completada. Puedes confirmar que voló,
                pero no marcarlo como “no voló”.
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Button
                variant="primary"
                size="md"
                className="min-h-11 rounded-xl"
                disabled={!c.puedeEditar(fila)}
                onClick={() => c.cambiarEstadoBorrador(fila, 'VUELO_COMPLETADO')}
              >
                <Check size={16} /> Voló
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="min-h-11 rounded-xl"
                disabled={!c.puedeMarcarNoVolado(fila)}
                onClick={() => c.cambiarEstadoBorrador(fila, 'CANCELADO')}
              >
                No voló
              </Button>
              {fila.tieneCambio && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-xl sm:col-span-2 xl:col-span-1"
                  disabled={c.mutacion.isPending}
                  onClick={() => c.cambiarEstadoBorrador(fila, estadoOriginal)}
                >
                  Deshacer este cambio
                </Button>
              )}
            </div>
          </div>
        )}

        {cantidadBorradores > 0 && !enCola && (
          <Button
            variant="primary"
            size="lg"
            className="w-full rounded-xl"
            loading={c.mutacion.isPending}
            disabled={c.mutacion.isPending}
            onClick={() => c.guardarMarcaciones(fila.reserva, fila.key)}
          >
            Guardar {cantidadBorradores === 1 ? 'marcación' : `${cantidadBorradores} marcaciones`}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function MarcacionPageView({
  c,
  autorizado,
}: {
  c: MarcacionController;
  autorizado: boolean;
}) {
  if (!autorizado) {
    return (
      <Card className="rounded-3xl border-amber-200 p-8 text-center dark:border-amber-900">
        <AlertCircle size={28} className="mx-auto mb-3 text-amber-500" />
        <h1 className="font-bold text-slate-900 dark:text-white">Acceso restringido</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          La marcación está disponible para los perfiles de recepción y administración.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Operación de vuelo
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            Marcación de pista
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Confirma quién voló y quién no, revisa el deslinde y registra la jornada desde una sola
            vista.
          </p>
        </div>
        <Button
          variant="secondary"
          className="min-h-11 shrink-0 rounded-xl"
          loading={c.reservasQuery.isFetching}
          onClick={() => void c.reservasQuery.refetch()}
        >
          <RefreshCw size={16} /> Actualizar
        </Button>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[210px_minmax(0,1fr)_280px]">
        <aside aria-label="Filtros y resumen de jornada">
          <PanelJornada c={c} />
        </aside>

        <main aria-label="Pasajeros de la jornada" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Pasajeros agendados
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {c.filasFiltradas.length} de {c.filasDelDia.length} pasajeros
              </p>
            </div>
            {c.resumen.borradores > 0 && (
              <Badge variant="amber">
                {c.resumen.borradores}{' '}
                {c.resumen.borradores === 1 ? 'cambio pendiente' : 'cambios pendientes'}
              </Badge>
            )}
          </div>
          <ListaPasajeros c={c} />
        </main>

        <aside aria-label="Detalle y marcación del pasajero">
          <PanelDetalle c={c} fila={c.filaSeleccionada} />
        </aside>
      </div>
    </div>
  );
}
