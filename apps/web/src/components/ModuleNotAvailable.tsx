"use client";

import Link from 'next/link';
import { Lock, Home } from 'lucide-react';

export function ModuleNotAvailable({ moduleName }: { moduleName: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 space-y-6">
      <div className="p-5 bg-slate-100 dark:bg-slate-800 rounded-full">
        <Lock size={40} className="text-slate-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Módulo no disponible</h1>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">
          El módulo &ldquo;{moduleName}&rdquo; no está incluido en tu plan actual.
          Contáctanos para conocer la versión Premium.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition"
      >
        <Home size={18} />
        <span>Volver al inicio</span>
      </Link>
    </div>
  );
}