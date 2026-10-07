export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Placeholder de carga para estados de loading.
 * Aporta `animate-pulse` y los colores slate (claro/oscuro); el consumidor
 * define tamaño y redondeo vía `className`, ej. 'h-3 w-20 rounded'.
 */
export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={`animate-pulse bg-slate-200 dark:bg-slate-700 ${className}`} {...props} />
  );
}
