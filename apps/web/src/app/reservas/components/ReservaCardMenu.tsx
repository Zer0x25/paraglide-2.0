"use client";

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, RotateCcw, Edit2, Trash2 } from 'lucide-react';
import type { ReservaConPasajeros } from '@/types/reservaDetalle';
import type { ReservaCardState } from '../utils/reservaCardState';

interface ReservaCardMenuProps {
  reserva: ReservaConPasajeros;
  state: ReservaCardState;
  onEdit: (reserva: ReservaConPasajeros) => void;
  onDelete: (reserva: ReservaConPasajeros) => void;
  onOpenPagos: (reserva: ReservaConPasajeros) => void;
  onOpenDesagendar?: (reserva: ReservaConPasajeros) => void;
  onReabrir?: (reserva: ReservaConPasajeros) => void;
}

export function ReservaCardMenu({
  reserva,
  state,
  onEdit,
  onDelete,
  onOpenPagos,
  onOpenDesagendar,
  onReabrir,
}: ReservaCardMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const {
    esCerrada,
    esEditable,
    esTerminal,
    estaSinAgendar,
    esInmutable,
    esEliminable,
    puedeEliminarPorPago,
    motivoNoEliminable,
  } = state;

  if (!esEditable && (esTerminal || esCerrada) && !(esCerrada && Boolean(onReabrir))) {
    return null;
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Acciones de reserva"
        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 min-w-9 min-h-9 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
      >
        <MoreVertical size={16} />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 min-w-45 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden py-1"
        >
          {esCerrada && onReabrir && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onReabrir(reserva);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition text-left cursor-pointer"
              title="Reabrir reserva cerrada contablemente (solo administradores)"
            >
              <RotateCcw size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
              Reabrir reserva
            </button>
          )}
          {esEditable && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onEdit(reserva);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left cursor-pointer"
            >
              <Edit2 size={14} className="text-slate-400 shrink-0" />
              Editar reserva
            </button>
          )}
          {onOpenDesagendar && !estaSinAgendar && !esInmutable && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onOpenDesagendar(reserva);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition text-left cursor-pointer"
              title="Liberar vuelos asignados y volver a Sin Agendar"
            >
              <RotateCcw size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
              Desagendar
            </button>
          )}
          {estaSinAgendar && !esInmutable && (
            esEliminable ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(reserva);
                }}
                title="Eliminar reserva"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
              >
                <Trash2 size={14} className="shrink-0" />
                Eliminar reserva
              </button>
            ) : (
              <div className="border-t border-slate-100 dark:border-slate-700/50">
                <button
                  type="button"
                  role="menuitem"
                  disabled
                  aria-disabled="true"
                  aria-describedby={`eliminar-help-${reserva.id}`}
                  title={motivoNoEliminable}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition text-slate-300 dark:text-slate-600 cursor-not-allowed"
                >
                  <Trash2 size={14} className="shrink-0" />
                  Eliminar reserva
                </button>
                <p
                  id={`eliminar-help-${reserva.id}`}
                  className="px-3 pb-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400"
                >
                  {!puedeEliminarPorPago ? (
                    <>
                      Tiene pagos registrados. Elimina los abonos en{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenPagos(reserva);
                        }}
                        className="font-semibold text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
                      >
                        Pagos
                      </button>
                      {' '}para poder eliminar.
                    </>
                  ) : (
                    motivoNoEliminable
                  )}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
