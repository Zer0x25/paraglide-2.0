"use client";

import Link from "next/link";

/**
 * Página de fallback offline (ADR 009). next-pwa la precachea y la sirve
 * cuando el usuario navega a una ruta no cacheada estando sin red.
 * No depende de datos del servidor: solo avisa y ofrece volver al inicio.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-5xl" aria-hidden>📡</div>
      <h1 className="text-2xl font-semibold">Estás sin conexión</h1>
      <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
        No hay red en este momento. Los datos ya cargados siguen disponibles y
        los cambios se enviarán automáticamente al reconectar.
      </p>
      <Link
        href="/"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
