/** Tamaño del spinner. */
export type SpinnerSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-[3px]',
  lg: 'h-12 w-12 border-4',
};

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Clases de color del borde, ej. 'border-blue-600 dark:border-blue-400'. */
  color?: string;
  className?: string;
}

/**
 * Indicador de carga circular.
 */
export function Spinner({ size = 'md', color = 'border-blue-600 dark:border-blue-400', className = '' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`animate-spin rounded-full border-current border-t-transparent ${sizeClasses[size]} ${color} ${className}`}
    />
  );
}
