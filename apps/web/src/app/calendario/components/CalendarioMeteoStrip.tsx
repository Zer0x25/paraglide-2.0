"use client";

import Link from "next/link";
import { Wind, Compass, Thermometer, Cloud, Sun, CloudSun } from "lucide-react";
import { useMeteorologia } from "@/hooks/useMeteorologia";
import { clasificarUv } from "@/utils/uv";
import { Skeleton } from "@/components/ui";

function SkeletonStrip() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 sm:px-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-2.5 w-2.5 rounded-full" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
        <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-14 rounded" />
        <Skeleton className="h-3 w-14 rounded" />
        <Skeleton className="h-3 w-12 rounded" />
      </div>
    </div>
  );
}

export function CalendarioMeteoStrip() {
  const { estadoActual, pronostico, loading, error } = useMeteorologia();

  if (loading) return <SkeletonStrip />;

  // Si hay error y no hay datos que mostrar, no rompe página — no renderiza
  if (error && !estadoActual && !pronostico) return null;

  // Si no hay ningún dato disponible, muestra placeholder compacto sin romper layout
  if (!estadoActual && !pronostico) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 sm:px-4 shadow-sm flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <CloudSun size={14} className="shrink-0" />
          Sin datos meteorológicos
        </span>
        <Link
          href="/meteorologia"
          className="ml-auto text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Ver estación
        </Link>
      </div>
    );
  }

  const estadoPista = estadoActual?.estadoPista ?? "DESCONOCIDO";
  const velocidadViento = estadoActual?.velocidadViento ?? pronostico?.velocidadViento ?? null;
  const rachaViento = estadoActual?.rachaViento ?? pronostico?.rachaViento ?? null;
  const direccionViento = estadoActual?.direccionViento ?? pronostico?.direccionViento ?? null;
  const temperatura = estadoActual?.temperatura ?? pronostico?.temperatura ?? null;
  const nubosidad = estadoActual?.nubosidad ?? pronostico?.nubosidad ?? null;
  const indiceUv = estadoActual?.indiceUv ?? pronostico?.indiceUv ?? null;

  const uv = clasificarUv(indiceUv);

  const estadoConfig =
    estadoPista === "ABIERTA"
      ? {
          label: "ABIERTA",
          dot: "bg-emerald-500",
          ping: "bg-emerald-400",
          text: "text-emerald-600 dark:text-emerald-400",
          badge: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50",
        }
      : estadoPista === "PRECAUCION"
        ? {
            label: "PRECAUCIÓN",
            dot: "bg-amber-500",
            ping: "bg-amber-400",
            text: "text-amber-600 dark:text-amber-400",
            badge: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50",
          }
        : estadoPista === "CERRADA"
          ? {
              label: "CERRADA",
              dot: "bg-red-500",
              ping: "bg-red-400",
              text: "text-red-600 dark:text-red-400",
              badge: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50",
            }
          : {
              label: estadoPista,
              dot: "bg-slate-400",
              ping: "bg-slate-300",
              text: "text-slate-500 dark:text-slate-400",
              badge: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
            };

  const fmt = (v: number | null | undefined, digits = 1, suffix = "") =>
    v != null && !Number.isNaN(Number(v)) ? `${Number(v).toFixed(digits)}${suffix}` : "—";

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-3 py-3 sm:px-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      {/* Semáforo pista */}
      <div
        className={`flex items-center gap-2 shrink-0 px-2.5 py-1 rounded-full border text-xs font-black tracking-tight ${estadoConfig.badge} ${estadoConfig.text}`}
        title={`Estado de pista: ${estadoConfig.label}`}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${estadoConfig.ping}`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${estadoConfig.dot}`} />
        </span>
        <span className="uppercase">{estadoConfig.label}</span>
      </div>

      <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0" />

      {/* Métricas compactas */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300" title="Viento sostenido">
          <Wind size={13} className="text-cyan-500 shrink-0" />
          <span className="font-bold">{fmt(velocidadViento, 1, " km/h")}</span>
          <span className="text-slate-400 font-medium hidden xs:inline">viento</span>
        </span>

        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300" title="Ráfaga máxima">
          <Wind size={13} className="text-amber-500 shrink-0" />
          <span className="font-bold">{fmt(rachaViento, 1, " km/h")}</span>
          <span className="text-slate-400 font-medium hidden xs:inline">ráfaga</span>
        </span>

        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300" title="Dirección del viento">
          <Compass size={13} className="text-blue-500 shrink-0" />
          <span className="font-bold uppercase">{direccionViento ?? "—"}</span>
        </span>

        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300" title="Temperatura">
          <Thermometer size={13} className="text-red-500 shrink-0" />
          <span className="font-bold">{fmt(temperatura, 1, "°C")}</span>
        </span>

        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300" title="Nubosidad">
          <Cloud size={13} className="text-slate-400 shrink-0" />
          <span className="font-bold">{nubosidad != null ? `${nubosidad}%` : "—"}</span>
        </span>

        <span
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 border text-[11px] font-bold ${uv.bg} ${uv.border} ${uv.color}`}
          title={uv.recomendacion}
        >
          <Sun size={12} className="shrink-0" />
          <span>UV {indiceUv != null ? Number(indiceUv).toFixed(1) : "—"}</span>
          {uv.nivel !== "DESCONOCIDO" && <span className="hidden sm:inline">· {uv.etiqueta}</span>}
        </span>
      </div>

      <Link
        href="/meteorologia"
        className="ml-auto hidden sm:inline-flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition shrink-0"
      >
        Ver detalle
      </Link>
    </div>
  );
}
