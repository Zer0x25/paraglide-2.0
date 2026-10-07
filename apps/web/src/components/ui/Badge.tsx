/** Color del badge. */
export type BadgeVariant = 'blue' | 'green' | 'red' | 'amber' | 'gray' | 'purple';

// Clases hardcodeadas por variante (Tailwind no detecta interpolación dinámica)
const softClasses: Record<BadgeVariant, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  gray: 'bg-slate-100 text-slate-700 dark:bg-slate-950/60 dark:text-slate-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
};

const solidClasses: Record<BadgeVariant, string> = {
  blue: 'bg-blue-600 text-white',
  green: 'bg-green-600 text-white',
  red: 'bg-red-600 text-white',
  amber: 'bg-amber-600 text-white',
  gray: 'bg-slate-600 text-white',
  purple: 'bg-purple-600 text-white',
};

export interface BadgeProps {
  variant?: BadgeVariant;
  /** true (default): fondo suave; false: fondo sólido. */
  soft?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Etiqueta pill para estados y categorías.
 */
export function Badge({ variant = 'gray', soft = true, className = '', children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        soft ? softClasses[variant] : solidClasses[variant]
      } ${className}`}
    >
      {children}
    </span>
  );
}
