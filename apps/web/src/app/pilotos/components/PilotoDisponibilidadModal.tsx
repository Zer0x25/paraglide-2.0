"use client";

import { X, ChevronLeft, ChevronRight, Broom } from 'lucide-react';
import type { PilotoDTO, HorarioBloquePayload } from '@parapente/shared';

interface PilotoDisponibilidadModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPiloto: PilotoDTO | null;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  selectAllMonth: () => void;
  invertMonth: () => void;
  resetAvailability: () => void;
  saveAvailability: () => Promise<void>;
  availDirty: boolean;
  saving: boolean;
  dragRef: React.MutableRefObject<{ painting: boolean; value: boolean } | null>;
  stopPaint: () => void;
  startPaint: (dateStr: string, clientX?: number, clientY?: number) => void;
  paintTo: (dateStr: string) => void;
  paintFromEvent: (clientX: number, clientY: number) => void;
  toggleDay: (dateStr: string) => void;
  openBlockSelector: (dateStr: string) => void;
  dayStateFor: (dateStr: string) => 'full' | 'partial' | 'none';
  blockSelector: { dateStr: string } | null;
  setBlockSelector: (val: { dateStr: string } | null) => void;
  blocksForDate: (dateStr: string) => HorarioBloquePayload[];
  isBlockSelected: (dateStr: string, horaInicio: string) => boolean;
  applyBlockToggle: (dateStr: string, horaInicio: string) => void;
}

export function PilotoDisponibilidadModal({
  isOpen,
  onClose,
  selectedPiloto,
  currentMonth,
  setCurrentMonth,
  selectAllMonth,
  invertMonth,
  resetAvailability,
  saveAvailability,
  availDirty,
  saving,
  dragRef,
  stopPaint,
  startPaint,
  paintTo,
  paintFromEvent,
  toggleDay,
  openBlockSelector,
  dayStateFor,
  blockSelector,
  setBlockSelector,
  blocksForDate,
  isBlockSelected,
  applyBlockToggle,
}: PilotoDisponibilidadModalProps) {
  if (!isOpen || !selectedPiloto) return null;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className="aspect-square"></div>);
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const state = dayStateFor(dateStr);
    const hasBlocks = blocksForDate(dateStr).length > 0;

    days.push(
      <button
        key={d}
        type="button"
        data-date={dateStr}
        title={hasBlocks ? 'Doble clic o mantén 0,6s para editar bloques' : undefined}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          // No usar setPointerCapture: captura el puntero y bloquea que
          // elementFromPoint detecte los días vecinos en touch.
          e.preventDefault();
          startPaint(dateStr, e.clientX, e.clientY);
        }}
        // Desktop: hover del vecino. Móvil: se maneja con pointermove+elementFromPoint.
        onPointerEnter={() => paintTo(dateStr)}
        onPointerUp={() => stopPaint()}
        onPointerCancel={() => stopPaint()}
        onClick={(e) => e.preventDefault()}
        onDoubleClick={(e) => { e.preventDefault(); openBlockSelector(dateStr); }}
        onContextMenu={(e) => { e.preventDefault(); openBlockSelector(dateStr); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDay(dateStr);
          }
        }}
        className={`relative aspect-square flex items-center justify-center rounded-full text-sm transition touch-none cursor-pointer select-none ${
          state === 'full'
            ? 'bg-blue-600 text-white font-bold'
            : state === 'partial'
              ? 'bg-amber-400 text-amber-950 font-bold'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
        } ${hasBlocks ? 'ring-1 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ring-slate-200 dark:ring-slate-700' : ''}`}
      >
        {d}
        {hasBlocks && state !== 'none' && (
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/90 dark:bg-white shadow" aria-hidden />
        )}
        {hasBlocks && state === 'none' && (
          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" aria-hidden />
        )}
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl w-full max-w-md p-5 sm:p-6 relative max-h-[90vh] overflow-y-auto my-auto">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><X size={24} /></button>
          <h2 className="text-xl font-bold mb-1 text-slate-800 dark:text-white">Disponibilidad</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{selectedPiloto.nombre}</p>
          
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={selectAllMonth}
              className="flex items-center justify-center px-3 py-2.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-semibold border border-blue-100 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-950 transition cursor-pointer"
            >
              Seleccionar todo
            </button>
            <button
              type="button"
              onClick={invertMonth}
              className="flex items-center justify-center px-3 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-100 dark:border-indigo-900 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition cursor-pointer"
            >
              Invertir selección
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} 
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft />
              </button>
              <span className="font-semibold text-slate-900 dark:text-white uppercase text-sm">
                {currentMonth.toLocaleString('es', { month: 'long', year: 'numeric' })}
              </span>
              <button 
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} 
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight />
              </button>
            </div>
            
            <div
              className="grid grid-cols-7 gap-1.5 text-center select-none touch-none"
              style={{ touchAction: 'none' }}
              onPointerMove={(e) => {
                // Móvil: elementFromPoint bajo el dedo. Desktop las celdas ya manejan pointerenter.
                paintFromEvent(e.clientX, e.clientY);
                if (dragRef.current?.painting) e.preventDefault();
              }}
              onPointerUp={stopPaint}
              onPointerLeave={stopPaint}
              onPointerCancel={stopPaint}
            >
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="text-[10px] font-bold text-slate-400 dark:text-slate-500 py-1">{d}</div>)}
              {days}
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-md text-[11px] leading-relaxed text-blue-700 dark:text-blue-300">
              Toca o arrastra para marcar días <strong>disponibles</strong> (azul).{' '}
              <span className="hidden sm:inline">Mantén 0,6s</span><span className="sm:hidden">Mantén presionado</span> un día con bloques, o haz <strong>doble clic / clic derecho</strong>, para elegir <strong>bloques</strong>.
            </div>
            <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Completo</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span> Parcial</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 inline-block"></span> No disponible</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={resetAvailability}
              title={`Limpiar solo ${currentMonth.toLocaleString('es', { month: 'long', year: 'numeric' })}`}
              aria-label="Limpiar mes visible"
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-900 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition cursor-pointer"
            >
              <Broom size={16} />
              <span className="hidden md:inline text-xs font-semibold">Limpiar mes</span>
            </button>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveAvailability}
                disabled={!availDirty || saving}
                className={`px-4 py-2 rounded-md transition font-medium cursor-pointer ${availDirty && !saving ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Bloques (long-press) */}
      {blockSelector && selectedPiloto && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4" onClick={() => setBlockSelector(null)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xs p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800 dark:text-white">Bloques del día</h3>
              <button onClick={() => setBlockSelector(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"><X size={20} /></button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {(() => {
                const [y, m, d] = blockSelector.dateStr.split('-').map(Number);
                return new Date(y, m - 1, d).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
              })()}
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {blocksForDate(blockSelector.dateStr).length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                  No hay bloques configurados para este día.
                </p>
              )}
              {blocksForDate(blockSelector.dateStr).map((b: HorarioBloquePayload) => (
                <label
                  key={b.horaInicio}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                    isBlockSelected(blockSelector.dateStr, b.horaInicio)
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {b.horaInicio} - {b.horaFin}
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 rounded cursor-pointer"
                    checked={isBlockSelected(blockSelector.dateStr, b.horaInicio)}
                    onChange={() => applyBlockToggle(blockSelector.dateStr, b.horaInicio)}
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setBlockSelector(null)}
              className="w-full mt-4 bg-slate-900 dark:bg-slate-800 text-white py-2 rounded-md hover:bg-slate-800 dark:hover:bg-slate-700 transition font-medium cursor-pointer"
            >
              Establecer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
