import type { RefObject } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { Spinner } from '@/components/ui';
import type { ReservaConPasajeros, PasajeroConVuelos, VueloConPiloto } from '@/types/reservaDetalle';
import { ReservaCard } from './ReservaCard';

export interface ReservasTableProps {
  loading: boolean;
  reservas: ReservaConPasajeros[];
  sentinelRef?: RefObject<HTMLDivElement | null>;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage?: () => void;
  onEdit: (reserva: ReservaConPasajeros) => void;
  onDelete: (reserva: ReservaConPasajeros) => void;
  onOpenFirma: (pasajero: PasajeroConVuelos) => void;
  onOpenPagos: (reserva: ReservaConPasajeros) => void;
  onOpenVoucher: (reserva: ReservaConPasajeros) => void;
  onOpenAgendar: (reserva: ReservaConPasajeros) => void;
  onOpenCancelar: (reserva: ReservaConPasajeros) => void;
  onOpenDesagendar: (reserva: ReservaConPasajeros) => void;
  onReabrir: (reserva: ReservaConPasajeros) => void;
  onWhatsAppConfirmation: (reserva: ReservaConPasajeros) => void;
  onWhatsAppPiloto: (reserva: ReservaConPasajeros, pasajero: PasajeroConVuelos, vuelo: VueloConPiloto) => void;
}

export function ReservasTable({
  loading,
  reservas,
  sentinelRef,
  hasNextPage,
  isFetchingNextPage,
  onFetchNextPage,
  onEdit,
  onDelete,
  onOpenFirma,
  onOpenPagos,
  onOpenVoucher,
  onOpenAgendar,
  onOpenCancelar,
  onOpenDesagendar,
  onReabrir,
  onWhatsAppConfirmation,
  onWhatsAppPiloto,
}: ReservasTableProps) {
  return (
    <>
      {/* Grid de Tarjetas de Reservas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full p-12 text-center text-slate-400">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p>Cargando reservas...</p>
          </div>
        ) : reservas.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-100 dark:border-slate-800 text-center space-y-2">
            <Users size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <p className="font-bold text-slate-700 dark:text-slate-300">No se encontraron reservas</p>
            <p className="text-slate-400 text-xs">Prueba cambiando los filtros o el término de búsqueda.</p>
          </div>
        ) : (
          reservas.map((reserva) => (
            <ReservaCard
              key={reserva.id}
              reserva={reserva}
              onEdit={onEdit}
              onDelete={onDelete}
              onOpenFirma={onOpenFirma}
              onOpenPagos={onOpenPagos}
              onOpenVoucher={onOpenVoucher}
              onOpenAgendar={onOpenAgendar}
              onOpenCancelar={onOpenCancelar}
              onOpenDesagendar={onOpenDesagendar}
              onReabrir={onReabrir}
              onWhatsAppConfirmation={onWhatsAppConfirmation}
              onWhatsAppPiloto={onWhatsAppPiloto}
            />
          ))
        )}
      </div>

      {/* Scroll infinito on-demand */}
      {!loading && reservas.length > 0 && (
        <div className="flex flex-col items-center justify-center pt-4 pb-8 space-y-3">
          <div ref={sentinelRef} className="h-4 w-full" />

          {isFetchingNextPage ? (
            <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400 text-xs font-semibold py-2 px-4 bg-slate-100/80 dark:bg-slate-800/80 rounded-full border border-slate-200 dark:border-slate-700">
              <Spinner size="sm" color="border-blue-600 dark:border-blue-400" />
              <span>Cargando más reservas...</span>
            </div>
          ) : hasNextPage ? (
            <button
              onClick={() => onFetchNextPage?.()}
              className="flex items-center justify-center space-x-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <ChevronDown size={14} />
              <span>Cargar más reservas</span>
            </button>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium py-2">
              Has llegado al final de las reservas ({reservas.length} reservas)
            </p>
          )}
        </div>
      )}
    </>
  );
}

// Alias semántico para interoperabilidad (Grid / Tabla de Reservas)
export const ReservasGrid = ReservasTable;
