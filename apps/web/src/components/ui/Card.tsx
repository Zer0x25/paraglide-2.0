import type { HTMLAttributes } from 'react';

/**
 * Clases estándar de tarjeta, exportadas para usos sin componente.
 */
export const cardClass =
  'rounded-2xl bg-white dark:bg-slate-800/80 shadow-sm border border-slate-200 dark:border-slate-700 p-5';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Contenedor tipo tarjeta con padding estándar.
 */
export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div className={`${cardClass} ${className}`} {...rest}>
      {children}
    </div>
  );
}
