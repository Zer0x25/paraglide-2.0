"use client";

import { useCalendarioController } from './hooks/useCalendarioController';
import {
  CalendarioHeader,
  CalendarioView,
  CalendarioModals,
} from './components';

export default function CalendarioPage() {
  const c = useCalendarioController();

  return (
    <div className="space-y-6 h-full flex flex-col relative">
      {/* Header y Filtros de Vista */}
      <CalendarioHeader
        mostrarAgendas={c.mostrarAgendas}
        onToggleMostrarAgendas={() => c.setMostrarAgendas((v) => !v)}
        onOpenConfigModal={() => c.setIsConfigModalOpen(true)}
        onOpenSyncModal={() => c.setIsSyncModalOpen(true)}
      />

      {/* Vista de Calendario (Mensual RBC / VistaAgendas por Bloques) */}
      <CalendarioView controller={c} />

      {/* Orquestación de Diálogos Modales (Vuelo, Sync, ConfigBloques, Pagos) */}
      <CalendarioModals controller={c} />
    </div>
  );
}
