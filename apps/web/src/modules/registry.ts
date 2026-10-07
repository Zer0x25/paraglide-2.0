import {
  Wrench,
  FileText,
  Wind,
  Tv,
  MessageSquare,
  Bug,
  type LucideIcon,
} from 'lucide-react';

import { isModuleEnabledRuntime, type ModuleId as RuntimeModuleId } from './runtime';

export type ModuleId =
  | 'equipos'
  | 'reportes'
  | 'meteorologia'
  | 'pantalla'
  | 'plantillas'
  | 'dev';

export interface Module {
  id: ModuleId;
  label: string;
  href: string;
  icon: LucideIcon;
  section: 'main' | 'admin';
  adminOnly?: boolean;
  badge?: string;
  featured?: boolean;
  target?: string;
}

export const premiumModules: Module[] = [
  { id: 'equipos', label: 'Equipos & Mantenimiento', href: '/equipos', icon: Wrench, section: 'main' },
  { id: 'reportes', label: 'Manifiestos & Reportes', href: '/reportes', icon: FileText, section: 'main' },
  { id: 'meteorologia', label: 'Pista & Meteorología', href: '/meteorologia', icon: Wind, section: 'main' },
  { id: 'pantalla', label: 'Pantalla Sala / TV', href: '/pantalla', icon: Tv, section: 'main', badge: 'FIDS', target: '_blank' },
  { id: 'plantillas', label: 'Plantillas & WhatsApp', href: '/plantillas', icon: MessageSquare, section: 'main', adminOnly: true },
  { id: 'dev', label: 'Dev Tools', href: '/dev', icon: Bug, section: 'main', adminOnly: true, badge: 'DEV' },
];

// El estado de módulos premium se resuelve en RUNTIME (no en build-time) leyendo
// el estado compartido en `runtime.ts`, que se inicializa desde /api/modules y se
// actualiza en caliente vía SSE (modulos-cambios). El archivo modules.config.json
// en el repo/servidor es la fuente de verdad inicial y es reversible sin rebuild.
// Se delega directamente al runtime (que es un Set en memoria) para que un toggle
// en caliente se refleje al instante, sin usar un snapshot estático de import.

/**
 * Un módulo premium está habilitado según el estado runtime (modules.config.json
 * en el server, reflejado en el cliente vía /api/modules + SSE). Por defecto
 * (sin config) el default embebido en runtime.ts tiene todas las premium ON.
 */
export function isModuleEnabled(id: ModuleId): boolean {
  if (id === 'dev') {
    // DevTools es solo para desarrollo por diseño, no un módulo premium.
    return process.env.NODE_ENV === 'development';
  }
  return isModuleEnabledRuntime(id as RuntimeModuleId);
}

export function getEnabledPremiumModules(): Module[] {
  return premiumModules.filter((m) => isModuleEnabled(m.id));
}

export function getModule(id: ModuleId): Module | undefined {
  return premiumModules.find((m) => m.id === id);
}