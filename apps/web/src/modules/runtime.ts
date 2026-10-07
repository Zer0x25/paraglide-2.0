'use client';

import { useSyncExternalStore } from 'react';

// IDs de módulos premium (debe coincidir con apps/api/modules.config.json).
export const ALL_MODULE_IDS = [
  'equipos',
  'reportes',
  'meteorologia',
  'pantalla',
  'plantillas',
] as const;

export type ModuleId = (typeof ALL_MODULE_IDS)[number];

// Default embebido: todas las premium ON. Si el fetch a /api/modules falla o
// tarda, el primer render ya muestra el estado premium correcto. El endpoint
// y el SSE modulos-cambios lo sobreescriben en caliente.
const DEFAULT_ENABLED: ModuleId[] = [...ALL_MODULE_IDS];

let enabled = new Set<string>(DEFAULT_ENABLED);
let cachedSnapshot: string[] = [...enabled];

const listeners = new Set<() => void>();
let initialized = false;

function rebuildSnapshot() {
  const next = [...enabled].sort();
  // Solo actualizar la referencia si realmente cambió (evita bucles de
  // useSyncExternalStore: getSnapshot debe retornar la MISMA referencia si
  // el valor no cambió, si no React entra en Maximum update depth).
  const prev = cachedSnapshot;
  if (prev.length !== next.length || prev.some((v, i) => v !== next[i])) {
    cachedSnapshot = next;
  }
}

function emit() {
  rebuildSnapshot();
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* noop */
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string[] {
  // Referencia estable: solo cambia en emit() cuando el Set cambió.
  return cachedSnapshot;
}

// Llamado una vez al arrancar (desde un provider en el layout).
export async function initModulesRuntime(token?: string | null): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const url = token
      ? `/api/modules?token=${encodeURIComponent(token)}`
      : '/api/modules';
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { modules?: { id: string; enabled: boolean }[] };
      if (Array.isArray(data.modules)) {
        const next = new Set(data.modules.filter((m) => m.enabled).map((m) => m.id));
        if (next.size !== enabled.size || [...next].some((v) => !enabled.has(v))) {
          enabled = next;
          emit();
        }
      }
    }
  } catch {
    /* mantener default embebido */
  }
}

// Llamado desde el listener SSE cuando llega 'modulos-cambios'.
export function applyModulesChange(enabledIds: string[]): void {
  const next = new Set(enabledIds);
  if (next.size !== enabled.size || [...next].some((v) => !enabled.has(v))) {
    enabled = next;
    emit();
  }
}

export function isModuleEnabledRuntime(id: ModuleId): boolean {
  return enabled.has(id);
}

// Hook para que los componentes (ej. sidebar) reaccionen al cambio en caliente.
export function useEnabledModules(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
