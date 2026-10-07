import fs from 'fs';
import path from 'path';
import { subscribe, broadcastModulos } from './eventos.service';

// Ruta del config: universal entre dev (cwd=apps/api) y prod/Docker (cwd=/app).
// - Dev: cwd = .../apps/api → el JSON está en ./modules.config.json (junto al src).
// - Prod: cwd = /app, JSON copiado por el Dockerfile a apps/api/modules.config.json.
// Probamos candidate paths y usamos el primero que exista.
const _candidates = [
  path.resolve(process.cwd(), 'apps/api/modules.config.json'),
  path.resolve(process.cwd(), 'modules.config.json'),
  path.resolve(__dirname, '../../modules.config.json'),
];
const CONFIG_PATH = _candidates.find((p) => fs.existsSync(p)) ?? _candidates[0];

// Todos los módulos premium conocidos (fuente de verdad para el panel admin).
export const ALL_MODULE_IDS = [
  'equipos',
  'reportes',
  'meteorologia',
  'pantalla',
  'plantillas',
] as const;

export type ModuleId = (typeof ALL_MODULE_IDS)[number];

// Estado en memoria: conjunto de módulos habilitados.
let enabled = new Set<string>();

function loadFromDisk(): void {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { modules?: string[] };
    enabled = new Set(parsed.modules ?? []);
    console.log(`[modules] cargados ${enabled.size} módulos desde ${CONFIG_PATH}`);
  } catch (err) {
    console.warn('[modules] no se pudo leer modules.config.json, arrancando vacío:', err);
    enabled = new Set();
  }
}

// Cargar al importar el módulo (el cwd en prod es /app, así que apunta a /app/apps/api/modules.config.json).
loadFromDisk();

export function getEnabledModules(): string[] {
  return [...enabled];
}

export function getModuleStatus(): { id: string; enabled: boolean }[] {
  return ALL_MODULE_IDS.map((id) => ({ id, enabled: enabled.has(id) }));
}

export function setEnabledModules(list: string[]): { id: string; enabled: boolean }[] {
  // Validar contra la lista conocida para no persistir IDs inventados.
  const valid = list.filter((id) => (ALL_MODULE_IDS as readonly string[]).includes(id));
  enabled = new Set(valid);

  // Persistir al archivo de config (fuente de verdad versionada / montable).
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ modules: valid }, null, 2) + '\n', 'utf-8');
  } catch (err) {
    console.warn('[modules] no se pudo persistir modules.config.json:', err);
  }

  // Notificar a todos los clientes conectados vía SSE.
  broadcastModulos(valid);
  return getModuleStatus();
}

// Re-export para que las rutas puedan suscribirse si lo necesitan.
export { subscribe };
