"use client";

import Link from 'next/link';
import { Wind } from 'lucide-react';
import { useMeteorologia } from '../hooks/useMeteorologia';
import { Skeleton } from '@/components/ui';

export function WeatherWidget() {
  const { estadoActual, loading } = useMeteorologia();

  if (loading || !estadoActual) {
    return (
      <Skeleton className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs text-slate-400">
        <Wind size={14} />
        <span>Pista...</span>
      </Skeleton>
    );
  }

  const estado = estadoActual.estadoPista;

  return (
    <Link
      href="/meteorologia"
      className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-2xl text-xs font-black transition-all border shadow-xs ${
        estado === 'ABIERTA'
          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : estado === 'PRECAUCION'
          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
          : 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
      }`}
      title="Ver Estación Meteorológica y Estado de Pista"
    >
      <div className="flex items-center space-x-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              estado === 'ABIERTA' ? 'bg-emerald-400' : estado === 'PRECAUCION' ? 'bg-amber-400' : 'bg-red-400'
            }`}
          ></span>
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              estado === 'ABIERTA' ? 'bg-emerald-500' : estado === 'PRECAUCION' ? 'bg-amber-500' : 'bg-red-500'
            }`}
          ></span>
        </span>

        <span className="tracking-tight uppercase">
          {estado === 'ABIERTA' ? 'Pista Abierta' : estado === 'PRECAUCION' ? 'Precaución' : 'Pista Cerrada'}
        </span>
      </div>

      {estadoActual.velocidadViento !== null && estadoActual.velocidadViento !== undefined && (
        <div className="hidden sm:flex items-center space-x-1 text-[11px] font-mono border-l border-current/20 pl-2 opacity-90">
          <Wind size={12} />
          <span>{estadoActual.velocidadViento} km/h</span>
          {estadoActual.direccionViento && (
            <span className="uppercase font-bold">({estadoActual.direccionViento})</span>
          )}
        </div>
      )}
    </Link>
  );
}
