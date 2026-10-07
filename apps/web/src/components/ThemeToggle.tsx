"use client";

import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { resolvedTheme, theme, setTheme } = useTheme();

  // Botón smart de 1 acción (solo icono): muestra siempre la opción disponible
  // para cambiar. System resuelve oscuro -> icono Sol (ofrece Claro); si el
  // usuario ya eligió manual -> icono Laptop (ofrece volver a Sistema).
  // Los 3 estados se conservan en localStorage.
  const isDark = resolvedTheme === 'dark';
  const isSystem = theme === 'system';
  const showSystem = !isSystem;
  const showOppositeDark = isSystem && isDark;

  const Icon = showSystem ? Laptop : (showOppositeDark ? Sun : Moon);
  const title = showSystem
    ? "Volver a seguir al sistema (OS)"
    : (showOppositeDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro");
  const next = showSystem ? 'system' : (showOppositeDark ? 'light' : 'dark');

  return (
    <button
      onClick={() => setTheme(next)}
      className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-800/60 border border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
      title={title}
      aria-label={title}
    >
      <Icon size={18} />
    </button>
  );
}
