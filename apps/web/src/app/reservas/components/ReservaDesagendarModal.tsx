"use client";

import { CalendarX, RotateCcw } from "lucide-react";
import type { ReservaConPasajeros, VueloConPiloto } from "@/types/reservaDetalle";
import { Modal, Button } from "../../../components/ui";

interface ReservaDesagendarModalProps {
  reserva: ReservaConPasajeros | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  desagendando: boolean;
}

export function ReservaDesagendarModal({
  reserva,
  isOpen,
  onClose,
  onConfirm,
  desagendando,
}: ReservaDesagendarModalProps) {
  if (!reserva) return null;

  type VueloSoftDelete = VueloConPiloto & { deletedAt?: string | Date | null };
  const vuelosAgendados =
    reserva.pasajeros?.flatMap((p) => (p.vuelos ?? []) as VueloSoftDelete[]).filter((v) => v && !v.deletedAt) ?? [];
  const cantidadVuelos = vuelosAgendados.length;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Desagendar Reserva"
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={desagendando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => onConfirm()}
            loading={desagendando}
            className="bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
          >
            <RotateCcw size={14} className="mr-1.5" />
            Sí, Desagendar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Vas a desagendar la reserva{" "}
          <strong className="font-bold text-slate-900 dark:text-white">
            #{reserva.numeroReserva || reserva.id} — {reserva.nombreTitular}
          </strong>
          .
        </p>

        <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-3.5">
          <CalendarX size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-semibold">
              Se liberarán {cantidadVuelos} vuelo(s) y pilotos asignados en el calendario.
            </p>
            <p className="text-amber-700 dark:text-amber-300">
              La reserva volverá al estado <strong>«Sin Agendar»</strong>. Los datos del titular, pasajeros y pagos registrados permanecerán intactos.
            </p>
          </div>
        </div>

      </div>
    </Modal>
  );
}
