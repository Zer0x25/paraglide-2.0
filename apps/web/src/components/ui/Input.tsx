import { forwardRef, type InputHTMLAttributes } from 'react';

/**
 * Clases estándar de input, exportadas para usos sin componente
 * (selects nativos, textareas, etc.).
 */
export const inputClass =
  'w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/**
 * Input de texto estándar de la app.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...rest },
  ref,
) {
  return <input ref={ref} className={`${inputClass} ${className}`} {...rest} />;
});
