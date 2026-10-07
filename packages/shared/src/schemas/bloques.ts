import { z } from 'zod';

/** Franja horaria de un bloque de configuración. */
export const HorarioBloquePayloadSchema = z.object({
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'La hora debe tener formato HH:mm'),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/, 'La hora debe tener formato HH:mm'),
});
export type HorarioBloquePayload = z.infer<typeof HorarioBloquePayloadSchema>;

export const ConfiguracionBloqueSchema = z.object({
  id: z.number().optional(),
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  // Las tres formas de alcance son excluyentes entre sí (ver superRefine del
  // payload de creación); las tres juntas en null/undefined = INDEFINIDO.
  fechaInicio: z.string().or(z.date()).optional().nullable(),
  fechaFin: z.string().or(z.date()).optional().nullable(),
  fechaExacta: z.string().or(z.date()).optional().nullable(),
  bloqueado: z.boolean().default(false),
  // Fase 2: archivada = deja de aplicar a fechas futuras; se conserva para
  // consultas históricas (snapshot).
  archivada: z.boolean().default(false),
  archivadaEn: z.string().or(z.date()).optional().nullable(),
  horarios: z.array(HorarioBloquePayloadSchema).default([]),
  version: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type ConfiguracionBloqueDTO = z.infer<typeof ConfiguracionBloqueSchema>;

/**
 * Payload de creación de una configuración. Reglas de alcance (superRefine):
 * - Exactamente UNO de: fechaExacta | (fechaInicio + fechaFin) | ninguno (INDEFINIDO).
 * - No se permite fechaExacta junto a fechas de rango, ni rango incompleto.
 * - Los horarios son obligatorios (min 1) salvo que el bloque esté bloqueado.
 */
export const CreateConfiguracionPayloadSchema = ConfiguracionBloqueSchema.omit({
  id: true,
  archivada: true,
  archivadaEn: true,
  createdAt: true,
  updatedAt: true,
}).superRefine((data, ctx) => {
  const tieneExacta = data.fechaExacta != null;
  const tieneInicio = data.fechaInicio != null;
  const tieneFin = data.fechaFin != null;

  if (tieneExacta && (tieneInicio || tieneFin)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fechaExacta'],
      message: 'No se puede combinar fecha exacta con rango de fechas',
    });
    return;
  }
  if (tieneInicio !== tieneFin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [tieneInicio ? 'fechaFin' : 'fechaInicio'],
      message: 'El rango de fechas debe incluir inicio y fin',
    });
    return;
  }
  if (!data.bloqueado && data.horarios.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      type: 'array',
      minimum: 1,
      inclusive: true,
      path: ['horarios'],
      message: 'Debe definir al menos un horario (o marcar el bloque como bloqueado)',
    });
  }
});
// z.input (no z.infer): los campos con .default (bloqueado, horarios) deben ser
// OPCIONALES para quien envía el payload.
export type CreateConfiguracionPayload = z.input<typeof CreateConfiguracionPayloadSchema>;

/** Resultado de resolver qué configuración aplica a un día concreto. */
export const ResolucionDiaSchema = z.object({
  fecha: z.string(), // 'YYYY-MM-DD'
  configuracionId: z.number().nullable(),
  numero: z.number().nullable(), // numeración de reglas VIGENTES (#1, #2…)
  numeroInactiva: z.number().nullable(), // numeración aparte de archivadas (#IN1, #IN2…)
  nombre: z.string().nullable(),
  bloqueado: z.boolean(),
  horarios: z.array(
    z.object({
      horaInicio: z.string(),
      horaFin: z.string(),
    })
  ),
});
export type ResolucionDiaDTO = z.infer<typeof ResolucionDiaSchema>;

// ========================
// FUNCIONES PURAS DE CONFIGURACIÓN DE BLOQUES
// ========================

/**
 * Normaliza cualquier entrada de fecha a un string 'YYYY-MM-DD' de día calendario.
 *
 * DECISIÓN DE TIMEZONE: se usa el slice del ISO UTC (`toISOString().slice(0, 10)`).
 * Motivo: las fechas de bloques se almacenan UTC en la DB (convención del repo,
 * ver AGENTS.md "Dates are stored UTC") y el frontend ya convierte a local para
 * mostrar. Trabajar sobre el ISO UTC garantiza que API y web resuelvan el MISMO
 * día para el mismo dato, sin depender del TZ del proceso. El coste: un rango
 * definido con medianoche local en TZ positivas puede "ver" el día anterior en
 * UTC — aceptado porque toda la escritura también normaliza a UTC.
 */
export function aDiaCalendario(fecha: string | Date): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toISOString().slice(0, 10);
}

/** Tipo mínimo que `resolverConfiguracion`/`numerarConfigs` necesitan de una config. */
export interface ConfigResoluble {
  id?: number;
  nombre?: string;
  fechaInicio?: string | Date | null;
  fechaFin?: string | Date | null;
  fechaExacta?: string | Date | null;
  bloqueado?: boolean;
  archivada?: boolean;
  archivadaEn?: Date | string | null;
  horarios?: { horaInicio: string; horaFin: string }[];
  createdAt?: Date | string | null;
}

type AlcanceConfig = 'EXACTA' | 'RANGO' | 'INDEFINIDO';

function alcanceDe(config: ConfigResoluble): AlcanceConfig {
  if (config.fechaExacta != null) return 'EXACTA';
  if (config.fechaInicio != null || config.fechaFin != null) return 'RANGO';
  return 'INDEFINIDO';
}

function aplicaAlDia(config: ConfigResoluble, dia: string): boolean {
  switch (alcanceDe(config)) {
    case 'EXACTA':
      return aDiaCalendario(config.fechaExacta!) === dia;
    case 'RANGO': {
      // Rango abierto hacia adelante cuando no hay fechaFin.
      if (config.fechaInicio != null && aDiaCalendario(config.fechaInicio) > dia) return false;
      if (config.fechaFin != null && aDiaCalendario(config.fechaFin) < dia) return false;
      return true;
    }
    case 'INDEFINIDO':
      return true;
  }
}

const ORDEN_PRIORIDAD: Record<AlcanceConfig, number> = {
  EXACTA: 0,
  RANGO: 1,
  INDEFINIDO: 2,
};

/**
 * Resuelve qué configuración de bloques aplica a una fecha concreta.
 *
 * Prioridad: EXACTA > RANGO > INDEFINIDO. A igual prioridad gana la más
 * reciente (createdAt desc) como desempate determinista.
 *
 * Archivadas: si la fecha objetivo es >= hoy se IGNORAN (dejaron de aplicar);
 * si la fecha es pasada se INCLUYEN (snapshot histórico) siempre que la fecha
 * consultada sea anterior a su archivo (archivadaEn).
 *
 * @returns la config ganadora o null si ninguna aplica.
 */
export function resolverConfiguracion<T extends ConfigResoluble>(
  configs: T[],
  fechaISO: string | Date
): T | null {
  const dia = aDiaCalendario(fechaISO);
  const hoy = new Date().toISOString().slice(0, 10);
  const esPasada = dia < hoy;

  const candidatas = configs.filter((c) => {
    if (c.archivada) {
      if (!esPasada) return false; // archivada solo aplica a histórico
      // Si tiene archivadaEn, no puede aplicar a fechas iguales o posteriores a su archivo
      if (c.archivadaEn && dia >= aDiaCalendario(c.archivadaEn)) return false;
    }
    return aplicaAlDia(c, dia);
  });
  if (candidatas.length === 0) return null;

  const tiempoCreacion = (c: ConfigResoluble): number =>
    c.createdAt ? new Date(c.createdAt).getTime() : 0;

  return (
    candidatas.sort((a, b) => {
      const porPrioridad = ORDEN_PRIORIDAD[alcanceDe(a)] - ORDEN_PRIORIDAD[alcanceDe(b)];
      if (porPrioridad !== 0) return porPrioridad;

      // Desempate determinista dentro del mismo alcance:
      // Para fechas pasadas (histórico):
      // Si una regla existía en ese día histórico y otra fue creada con posterioridad
      // (ej. reemplazo nuevo creado hoy), la regla histórica tiene precedencia.
      if (esPasada) {
        const aFechaCreacion = a.createdAt ? aDiaCalendario(a.createdAt) : null;
        const bFechaCreacion = b.createdAt ? aDiaCalendario(b.createdAt) : null;
        const aExistiaEnDia = !aFechaCreacion || aFechaCreacion <= dia;
        const bExistiaEnDia = !bFechaCreacion || bFechaCreacion <= dia;

        if (aExistiaEnDia && !bExistiaEnDia) return -1;
        if (!aExistiaEnDia && bExistiaEnDia) return 1;

        // Si ambas son archivadas, gana la que fue archivada más tarde (vigente más tiempo)
        if (a.archivada && b.archivada && a.archivadaEn && b.archivadaEn) {
          const diffArch = new Date(b.archivadaEn).getTime() - new Date(a.archivadaEn).getTime();
          if (diffArch !== 0) return diffArch;
        }

        // Si una es archivada (snapshot de esa época) y la otra no, y la nueva fue creada después de dia
        if (a.archivada && !b.archivada && bFechaCreacion && bFechaCreacion > dia) {
          return -1;
        }
        if (b.archivada && !a.archivada && aFechaCreacion && aFechaCreacion > dia) {
          return 1;
        }
      }

      return tiempoCreacion(b) - tiempoCreacion(a); // más reciente primero
    })[0] ?? null
  );
}

/**
 * Numeración estable de configuraciones para etiquetar días resueltos.
 * SOLO considera reglas ACTIVAS (archivada !== true):
 * 1. INDEFINIDOS → #1 (si hay varios legacy, por createdAt asc).
 * 2. RANGOS → siguientes números, ordenados por fechaInicio asc.
 * 3. EXACTAS → al final, ordenadas por fechaExacta asc.
 *
 * Las ARCHIVADAS se numeran aparte con prefijo 'IN' (inactiva): #IN1, #IN2…
 * por createdAt asc — espacio de nombres separado que no colisiona con las
 * vigentes (el usuario ve #1..#3 activas y #IN1..#INn archivadas).
 *
 * @returns Map<id, etiqueta> donde etiqueta es { numero, archivada }.
 */
export function numerarConfigs<T extends ConfigResoluble>(
  configs: T[]
): Map<number, { numero: number; archivada: boolean }> {
  const tiempoCreacion = (c: ConfigResoluble): number =>
    c.createdAt ? new Date(c.createdAt).getTime() : 0;

  const activas = configs.filter((c) => !c.archivada);
  const archivadas = configs
    .filter((c) => c.archivada === true)
    .sort((a, b) => tiempoCreacion(a) - tiempoCreacion(b));

  const indefinidos = activas.filter((c) => alcanceDe(c) === 'INDEFINIDO');
  const rangos = activas
    .filter((c) => alcanceDe(c) === 'RANGO')
    .sort(
      (a, b) =>
        aDiaCalendario(a.fechaInicio!).localeCompare(aDiaCalendario(b.fechaInicio!)) ||
        tiempoCreacion(a) - tiempoCreacion(b)
    );
  const exactas = activas
    .filter((c) => alcanceDe(c) === 'EXACTA')
    .sort(
      (a, b) =>
        aDiaCalendario(a.fechaExacta!).localeCompare(aDiaCalendario(b.fechaExacta!)) ||
        tiempoCreacion(a) - tiempoCreacion(b)
    );

  const numeros = new Map<number, { numero: number; archivada: boolean }>();
  let siguiente = 1;
  for (const c of [...indefinidos.sort((a, b) => tiempoCreacion(a) - tiempoCreacion(b)), ...rangos, ...exactas]) {
    if (c.id != null) numeros.set(c.id, { numero: siguiente++, archivada: false });
  }
  let siguienteIn = 1;
  for (const c of archivadas) {
    if (c.id != null) numeros.set(c.id, { numero: siguienteIn++, archivada: true });
  }
  return numeros;
}

/** Etiqueta legible de una entrada de numeración: '#2' o '#IN3'. */
export function etiquetaNumero(entrada: { numero: number; archivada: boolean } | undefined): string | null {
  if (!entrada) return null;
  return entrada.archivada ? `#IN${entrada.numero}` : `#${entrada.numero}`;
}
