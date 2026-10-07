'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

/** Tamaño del panel del modal. */
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
};

export interface ModalProps {
  /** Si es false no renderiza nada. */
  open: boolean;
  /** Llamado al cerrar (Escape, backdrop o botón X). */
  onClose: () => void;
  /** Título en el header. Opcional. */
  title?: string;
  children: ReactNode;
  /** Contenido opcional del footer (borde superior). */
  footer?: ReactNode;
  /** Tamaño del panel. Default 'md'. */
  size?: ModalSize;
}

/**
 * Modal accesible: cierra con Escape y click en backdrop,
 * bloquea el scroll del body mientras está abierto.
 */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // onClose se guarda en un ref para que el efecto de foco NO se re-ejecute en
  // cada render (si el padre pasa una función inline, como onClose={() => ...},
  // el efecto volvería a correr en cada tecla y panelRef.focus() robaría el foco
  // del input, sacando al usuario de la escritura).
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape para cerrar + bloqueo de scroll del body + gestión de foco.
  // Solo depende de `open`: corre una vez al abrir y una al cerrar.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Guardar foco actual y enfocar el panel al abrir
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      // Restaurar foco al cerrar
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-h-[90vh] flex flex-col outline-none animate-in fade-in zoom-in-95 duration-200 ${sizeClasses[size]}`}
      >
        <div className="flex items-center justify-between px-6 py-4">
          {title ? (
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
