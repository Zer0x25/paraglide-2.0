"use client";

import { AlertCircle } from 'lucide-react';

export function VoucherLoading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-white">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
        Generando tu Boarding Pass...
      </p>
    </div>
  );
}

interface VoucherNotFoundProps {
  error?: string | null;
}

export function VoucherNotFound({ error }: VoucherNotFoundProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-white">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-2xl">
        <AlertCircle size={48} className="text-red-500 mx-auto" />
        <h1 className="text-xl font-black">Voucher no encontrado</h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs">
          {error || 'El código del voucher no es válido o ha expirado.'}
        </p>
      </div>
    </div>
  );
}
