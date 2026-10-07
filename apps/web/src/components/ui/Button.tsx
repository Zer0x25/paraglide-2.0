'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

/** Variante visual del botón. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
/** Tamaño del botón. */
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white focus-visible:ring-blue-500',
  secondary:
    'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500',
  ghost: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[36px]',
  lg: 'px-5 py-2.5 text-base min-h-[44px]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Variante visual. Default 'primary'. */
  variant?: ButtonVariant;
  /** Tamaño. Default 'md'. */
  size?: ButtonSize;
  /** Muestra spinner y deshabilita el botón. */
  loading?: boolean;
}

/**
 * Botón estándar de la app con variantes, tamaños y estado de carga.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size="sm" className="border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
});
