"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plane, CheckCircle2 } from 'lucide-react';

interface SlideToCompleteProps {
  isCompleted: boolean;
  onToggle: (completed: boolean) => void;
  disabled?: boolean;
  disabledReason?: string | null;
}

export function SlideToComplete({
  isCompleted,
  onToggle,
  disabled,
  disabledReason,
}: SlideToCompleteProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [dragProgress, setDragProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const displayProgress = isDragging ? dragProgress : (isCompleted ? 1 : 0);
  const [trackWidth, setTrackWidth] = useState(0);
  const dragProgressRef = useRef(0);

  const THUMB = 44; // 44px target mínimo táctil (Apple HIG)
  const THRESHOLD = 0.82;

  const syncTrackWidth = useCallback(() => {
    if (trackRef.current) setTrackWidth(trackRef.current.clientWidth);
  }, []);

  useEffect(() => {
    syncTrackWidth();
    const ro = new ResizeObserver(syncTrackWidth);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener('resize', syncTrackWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncTrackWidth);
    };
  }, [syncTrackWidth]);

  // Mantener ref sincronizada para leer en pointerUp sin stale closure
  useEffect(() => {
    dragProgressRef.current = dragProgress;
  }, [dragProgress]);

  const getProgressFromClientX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const maxDrag = Math.max(0, rect.width - THUMB - 8); // 8 = p-1 *2
    if (maxDrag <= 0) return 0;
    // thumb centrado: clientX relativo al centro del thumb
    const raw = clientX - rect.left - THUMB / 2 - 4;
    const clamped = Math.max(0, Math.min(maxDrag, raw));
    return clamped / maxDrag;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || isCompleted) return;
    e.preventDefault();
    const target = trackRef.current;
    if (!target) return;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    const p = getProgressFromClientX(e.clientX);
    setDragProgress(p);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const p = getProgressFromClientX(e.clientX);
    setDragProgress(p);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      trackRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    const finalProgress = dragProgressRef.current;
    if (finalProgress >= THRESHOLD) {
      try { navigator.vibrate?.(30); } catch {}
      setDragProgress(1);
      onToggle(true);
    } else {
      setDragProgress(0);
      // diferencia vs onToggle(false): no dispara guardado si ya estaba en false
      if (finalProgress > 0.08) onToggle(false);
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDragProgress(0);
    onToggle(false);
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      // Móvil: evita scroll / selección mientras se desliza
      style={{ touchAction: 'none' } as React.CSSProperties}
      title={disabled && disabledReason ? disabledReason : undefined}
      className={`relative h-12 w-64 sm:w-72 max-w-full rounded-full select-none overflow-hidden transition-all flex items-center p-1 border shadow-xs ${
        disabled
          ? 'opacity-50 cursor-not-allowed bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
          : isCompleted
            ? 'bg-emerald-600 dark:bg-emerald-700 border-emerald-500 shadow-sm cursor-default'
            : 'bg-slate-200/90 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 cursor-grab active:cursor-grabbing touch-manipulation'
      }`}
      role="switch"
      aria-checked={isCompleted}
      aria-disabled={disabled}
      aria-label="Vuelo completado"
    >
      {/* Relleno dinámico al arrastrar */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-emerald-500/25 transition-all pointer-events-none rounded-full"
        style={{ width: `${Math.max(12, displayProgress * 100)}%` }}
      />

      {/* Texto de seguridad dentro de la barra deslizante */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-bold transition-all px-9">
        {isCompleted ? (
          <span className="text-white flex items-center gap-1.5 font-black tracking-wide drop-shadow-xs animate-in fade-in">
            <Plane size={14} className="rotate-45" /> Vuelo completado
          </span>
        ) : (
          <span
            className="text-slate-600 dark:text-slate-300 flex items-center gap-1 font-extrabold tracking-tight transition-opacity"
            style={{ opacity: 1 - displayProgress * 0.7 }}
          >
            Deslizar para completar →
          </span>
        )}
      </div>

      {/* Botón / Thumb deslizante — h-11/w-11 mínimo táctil móvil */}
      <div
        ref={thumbRef}
        className={`h-11 w-11 min-h-11 min-w-11 rounded-full flex items-center justify-center text-white shadow-md z-10 transition-transform shrink-0 ${
          isCompleted
            ? 'bg-white text-emerald-600 ml-auto shadow-emerald-950/20'
            : 'bg-emerald-600 dark:bg-emerald-500 text-white active:scale-95'
        }`}
        style={
          isCompleted
            ? undefined
            : {
                transform: `translateX(${
                  displayProgress * Math.max(0, trackWidth - THUMB - 8)
                }px)`,
                transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
              }
        }
      >
        {isCompleted ? (
          <CheckCircle2 size={20} className="text-emerald-600" />
        ) : (
          <Plane size={18} className="transform rotate-45" />
        )}
      </div>

      {/* Botón sutil para deshacer si ya está completado */}
      {isCompleted && !disabled && (
        <button
          type="button"
          onClick={handleReset}
          className="absolute left-3 text-emerald-100 hover:text-white p-1 rounded-full text-[10px] font-bold underline transition z-20 cursor-pointer"
          title="Deshacer / Volver a pendiente"
        >
          Deshacer
        </button>
      )}
    </div>
  );
}
