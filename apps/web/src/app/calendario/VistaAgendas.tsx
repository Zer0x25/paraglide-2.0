"use client";

import React from 'react';
import {
  dateKeyLocal,
  esMismoDia,
  pilotosDisponiblesDia,
  vueloEnBloque,
  type PilotoDia,
  type VueloVista,
} from './agendas.util';
import { usePilotosDisponibilidadEfectiva } from './hooks/usePilotosDisponibilidadEfectiva';
import { AgendaNavHeader } from './components/AgendaNavHeader';
import { AgendaEstadoVacio } from './components/AgendaEstadoVacio';
import { AgendaBloqueHorario } from './components/AgendaBloqueHorario';
import { AgendaVuelosFueraBloque } from './components/AgendaVuelosFueraBloque';

export interface VistaAgendasProps {
  fecha: Date;
  vuelos: VueloVista[];
  pilotos: PilotoDia[];
  /** Configuración de bloques ya resuelta para la fecha visible (o null si no aplica). */
  configDia: { bloqueado: boolean; horarios: { horaInicio: string; horaFin: string }[] } | null;
  onNavigate?: (nuevaFecha: Date) => void;
  /** Se invoca al hacer click en una ficha/bloque disponible para agendar. */
  onAgendar?: (fecha: Date, horario: { horaInicio: string; horaFin: string }) => void;
  /** Se invoca al hacer click en una tarjeta de vuelo para editarla. */
  onEditar?: (vuelo: VueloVista) => void;
}

export default function VistaAgendas({
  fecha,
  vuelos,
  pilotos,
  configDia,
  onNavigate,
  onAgendar,
  onEditar,
}: VistaAgendasProps) {
  // FIX 5: misma técnica que getDateKey de la página, compartida vía agendas.util.
  const dateKey = dateKeyLocal(fecha);
  const hoyKey = dateKeyLocal(new Date());

  const { pilotosEfectivos } = usePilotosDisponibilidadEfectiva(pilotos, dateKey);
  const disponibles = pilotosDisponiblesDia(pilotosEfectivos, dateKey);

  // FIX 2: vuelos del día que no caen en ningún bloque configurado.
  const vuelosDelDia = vuelos.filter((v) => esMismoDia(v.fechaHora, dateKey));
  const vuelosFueraDeBloque =
    configDia && !configDia.bloqueado
      ? vuelosDelDia.filter(
          (v) => !configDia.horarios.some((h) => vueloEnBloque(v, dateKey, h.horaInicio, h.horaFin))
        )
      : vuelosDelDia;

  return (
    <div className="flex flex-col gap-4 min-h-full">
      {/* Barra de navegación del día */}
      <AgendaNavHeader
        fecha={fecha}
        dateKey={dateKey}
        hoyKey={hoyKey}
        onNavigate={onNavigate}
      />

      {!configDia ? (
        <div className="flex flex-col gap-4">
          <AgendaEstadoVacio tipo="sin-bloques" />
          <AgendaVuelosFueraBloque
            vuelos={vuelosFueraDeBloque}
            titulo="Vuelos asignados este día"
            onEditar={onEditar}
          />
        </div>
      ) : configDia.bloqueado ? (
        <div className="flex flex-col gap-4">
          <AgendaEstadoVacio tipo="bloqueado" />
          <AgendaVuelosFueraBloque
            vuelos={vuelosFueraDeBloque}
            titulo="Vuelos asignados en día bloqueado"
            onEditar={onEditar}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {configDia.horarios.map((horario, idx) => (
            <AgendaBloqueHorario
              key={`${horario.horaInicio}-${idx}`}
              horario={horario}
              fecha={fecha}
              dateKey={dateKey}
              vuelos={vuelos}
              disponibles={disponibles}
              onAgendar={onAgendar}
              onEditar={onEditar}
            />
          ))}
          <AgendaVuelosFueraBloque
            vuelos={vuelosFueraDeBloque}
            titulo="Fuera de bloques configurados"
            descripcion="Vuelos programados fuera de los horarios regulares o configurados para este día:"
            onEditar={onEditar}
          />
        </div>
      )}
    </div>
  );
}
