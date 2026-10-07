"use client";

import type { ComponentType } from 'react';
import { isModuleEnabled, getModule, type ModuleId } from '@/modules/registry';
import { useEnabledModules } from '@/modules/runtime';
import { ModuleNotAvailable } from './ModuleNotAvailable';
import { OfflinePageGuard } from './OfflinePageGuard';

// ADR 009: módulos premium con soporte offline completo (outbox + IndexedDB)
// como 'equipos' y 'plantillas' no deben ser bloqueados por el OfflinePageGuard.
const OFFLINE_UNSUPPORTED_MODULES: ModuleId[] = ['reportes', 'meteorologia', 'pantalla'];

export function withModule<P extends object>(id: ModuleId, Component: ComponentType<P>) {
  return function ModulePage(props: P) {
    // Suscripción al store de módulos: sin este hook, el toggle en caliente vía
    // SSE (`modulos-cambios`) actualizaba el Set pero no re-renderizaba la página
    // ya montada (isModuleEnabled es una lectura imperativa sin suscripción).
    useEnabledModules();
    const mod = getModule(id);
    if (!isModuleEnabled(id)) {
      return <ModuleNotAvailable moduleName={mod?.label ?? id} />;
    }
    const needsOfflineGuard = OFFLINE_UNSUPPORTED_MODULES.includes(id);
    if (needsOfflineGuard) {
      return (
        <OfflinePageGuard pageTitle={mod?.label ?? id}>
          <Component {...props} />
        </OfflinePageGuard>
      );
    }
    return <Component {...props} />;
  };
}