"use client";

import { AlertTriangle, CalendarX } from "lucide-react";
import type { ReservaConPasajeros, VueloConPiloto } from "@/types/reservaDetalle";
import { Modal, Button } from "../../../components/ui";

interface ReservaEliminarModalProps {
  reserva: ReservaConPasajeros | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eliminando: boolean;
}

export function ReservaEliminarModal({
  reserva,
  isOpen,
  onClose,
  onConfirm,
  eliminando,
}: ReservaEliminarModalProps) {
  if (!reserva) return null;

  type VueloSoftDelete = VueloConPiloto & { deletedAt?: string | Date | null };
  const vuelosAgendados =
    reserva.pasajeros?.flatMap((p) => (p.vuelos ?? []) as VueloSoftDelete[]).filter((v) => v && !v.deletedAt) ?? [];
  const tieneVuelos = vuelosAgendados.length > 0;
  const tienePagos = (reserva.pagos?.length ?? 0) > 0 || (reserva.abono ?? 0) > 0;

  return (
    <Modal open={isOpen} onClose={onClose} title="Eliminar reserva" size="md" footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={eliminando}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={eliminando}>
            Sí, eliminar
          </Button>
        </div>
      }>
      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Vas a eliminar la reserva{" "}
          <strong className="font-bold text-slate-900 dark:text-white">
            #{reserva.numeroReserva || reserva.id} — {reserva.nombreTitular}
          </strong>{" "}
          y sus <strong>{reserva.pasajeros?.length ?? 0} pasajero(s)</strong>.
        </p>

        <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed">
            Esta acción es <strong>irreversible</strong> (soft-delete). La reserva, sus pasajeros y sus pagos
            quedarán archivados y dejarán de aparecer en listados y reportes.
          </p>
        </div>

        {tieneVuelos && (
          <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
            <CalendarX size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              Se <strong>liberará el calendario</strong>: {vuelosAgendados.length} vuelo(s) agendado(s) de esta
              reserva serán eliminados y los bloques quedarán disponibles para otros pasajeros.
            </p>
          </div>
        )}

        {tienePagos && reserva.estadoPago === "DEVUELTO" && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            La reserva tiene devolución registrada, por lo que puede eliminarse de forma segura.
          </p>
        )}

        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          ¿Confirmas la eliminación?
        </p>
      </div>
    </Modal>
  );
}
