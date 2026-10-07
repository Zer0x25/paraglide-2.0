'use client';

import React from 'react';
import Link from 'next/link';
import { WifiOff, BookOpen, Home } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface OfflinePageGuardProps {
  children: React.ReactNode;
  pageTitle?: string;
}

/**
 * Guard para páginas no optimizadas para funcionamiento offline (ADR 009).
 * Muestra un aviso elegante cuando el usuario está sin conexión,
 * orientándolo a las secciones operativas que sí cuentan con soporte offline.
 */
export function OfflinePageGuard({ children, pageTitle }: OfflinePageGuardProps) {
  const online = useOnlineStatus();

  if (online) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 md:py-24 px-4 sm:px-6 space-y-6 max-w-xl mx-auto animate-in fade-in duration-300">
      <div className="p-5 bg-amber-100 dark:bg-amber-950/60 rounded-3xl text-amber-600 dark:text-amber-400 ring-8 ring-amber-500/10 shadow-inner">
        <WifiOff size={44} className="stroke-[2.2]" />
      </div>

      <div className="space-y-3">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
          Modo Offline
        </span>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          Temporalmente fuera de servicio en modo offline
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base leading-relaxed">
          {pageTitle ? (
            <>La sección <strong className="text-slate-800 dark:text-slate-200">&ldquo;{pageTitle}&rdquo;</strong> requiere conexión activa con el servidor.</>
          ) : (
            <>Esta sección requiere conexión activa con el servidor.</>
          )}{' '}
          Las funciones operativas de <strong>Inicio, Pilotos, Reservas, Calendario, Equipos, Plantillas y Configuración</strong> siguen 100% disponibles sin conexión.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/reservas"
          className="inline-flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-blue-700 active:scale-95 transition shadow-sm"
        >
          <BookOpen size={18} />
          <span>Ir a Reservas</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition border border-slate-200 dark:border-slate-700"
        >
          <Home size={18} />
          <span>Volver al Inicio</span>
        </Link>
      </div>
    </div>
  );
}
