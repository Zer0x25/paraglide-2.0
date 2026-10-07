import { Prisma } from '@prisma/client';
import { prisma } from '../plugins/prisma';
import {
  aDiaCalendario,
  numerarConfigs,
  resolverConfiguracion,
  ResolucionDiaDTO,
} from '@parapente/shared';

/**
 * Servicio de reglas de negocio para Configuración de Bloques (Fase 2-B).
 *
 * Reglas de alcance:
 * - INDEFINIDO: solo UNO puede existir. Es la base (#1).
 * - RANGO: sobreescribe al indefinido. Varios permitidos SOLO si sus rangos
 *   no se pisan entre sí (rangos abiertos con fechaFin null solapan con todo
 *   rango/exacta posterior a su inicio).
 * - EXACTA: sobreescribe a todas. Varias permitidas salvo mismo día duplicado.
 *
 * Higiene (snapshot):
 * - El INDEFINIDO nunca se borra (DELETE /:id bloqueado). Al editarse (PATCH),
 *   la versión anterior se ARCHIVA como snapshot histórico y la nueva toma
 *   vigencia a partir de hoy (preservando el histórico inmutable).
 * - Borrar = ARCHIVAR (archivada=true, archivadaEn=now). JAMÁS deletedAt para
 *   bloques: el calendario histórico debe poder seguir resolviendo su config.
 *
 * NOTA sobre el plugin soft-delete: el cliente extendido de
 * `plugins/prisma.ts` filtra `deletedAt` en findMany/findFirst/count del modelo
 * raíz, pero NO en `$transaction` ni siempre en includes → aquí se filtra
 * `deletedAt: null` MANUALMENTE en toda query.
 */

/** Cliente Prisma estándar o transaccional (las validaciones corren dentro de tx). */
type Db = Prisma.TransactionClient | typeof prisma;

/** Error HTTP con statusCode, patrón usado por el resto de la API. */
export function errorHttp(statusCode: number, message: string): Error & { statusCode: number } {
  const err: Error & { statusCode: number } = Object.assign(new Error(message), { statusCode });
  return err;
}

interface DatosAlcance {
  nombre?: string;
  fechaInicio?: string | Date | null;
  fechaFin?: string | Date | null;
  fechaExacta?: string | Date | null;
}

type Alcance = 'EXACTA' | 'RANGO' | 'INDEFINIDO';

function alcanceDe(config: DatosAlcance): Alcance {
  if (config.fechaExacta != null) return 'EXACTA';
  if (config.fechaInicio != null || config.fechaFin != null) return 'RANGO';
  return 'INDEFINIDO';
}

/** Overlap inclusivo tratando null como ±infinito (comparación ISO YYYY-MM-DD). */
function solapan(
  aIni: string | null,
  aFin: string | null,
  bIni: string | null,
  bFin: string | null
): boolean {
  const MIN = '0000-01-01';
  const MAX = '9999-12-31';
  const ai = aIni ?? MIN;
  const af = aFin ?? MAX;
  const bi = bIni ?? MIN;
  const bf = bFin ?? MAX;
  return ai <= bf && af >= bi;
}

function fmtRango(c: { fechaInicio?: Date | string | null; fechaFin?: Date | string | null }): string {
  const ini = c.fechaInicio ? aDiaCalendario(c.fechaInicio) : 'inicio indefinido';
  const fin = c.fechaFin ? aDiaCalendario(c.fechaFin) : 'sin fecha de fin';
  return `${ini} → ${fin}`;
}

/**
 * Valida que una configuración nueva/editada no viole las reglas de solapamiento.
 * Debe llamarse DENTRO de la transacción que persiste, con el mismo cliente (tx).
 *
 * @param data valores EFECTIVOS tras aplicar el patch (en edición, mezclar
 *             los actuales con los entrantes antes de llamar).
 * @param excludeId id a excluir de la búsqueda (edición).
 * @throws Error con statusCode 400 y mensaje descriptivo (incluye fechas en conflicto).
 */
export async function validarSolapamientos(
  db: Db,
  data: DatosAlcance,
  excludeId?: number
): Promise<void> {
  // Filtro manual de deletedAt + archivada: solo las activas participan en las
  // reglas de unicidad/solapamiento (las archivadas son snapshot histórico).
  const existentes = await db.configuracionBloque.findMany({
    where: {
      deletedAt: null,
      archivada: false,
      ...(excludeId != null ? { NOT: { id: excludeId } } : {}),
    },
  });

  const alcanceNuevo = alcanceDe(data);

  // (a) INDEFINIDO: único.
  if (alcanceNuevo === 'INDEFINIDO') {
    const otro = existentes.find((c: DatosAlcance & { nombre?: string }) => alcanceDe(c) === 'INDEFINIDO');
    if (otro) {
      throw errorHttp(400, `Ya existe una configuración indefinida ("${otro.nombre}")`);
    }
    return;
  }

  // (c) EXACTA: sin duplicados del mismo día.
  if (alcanceNuevo === 'EXACTA') {
    const dia = aDiaCalendario(data.fechaExacta!);
    const dup = existentes.find((c: { fechaExacta?: Date | string | null; nombre?: string }) => c.fechaExacta && aDiaCalendario(c.fechaExacta) === dia);
    if (dup) {
      throw errorHttp(
        400,
        `Ya existe una configuración para esta fecha exacta (${dia}): "${dup.nombre}"`
      );
    }
    return;
  }

  // (b) RANGO: no puede pisarse con otros rangos activos. Los rangos abiertos
  // (fechaFin null) solapan con todo lo posterior a su inicio.
  const nIni = data.fechaInicio ? aDiaCalendario(data.fechaInicio) : null;
  const nFin = data.fechaFin ? aDiaCalendario(data.fechaFin) : null;
  for (const c of existentes) {
    const alcanceExistente = alcanceDe(c);
    if (alcanceExistente !== 'RANGO') continue; // indefinidos y exactas no colisionan con rangos
    if (
      solapan(
        nIni,
        nFin,
        c.fechaInicio ? aDiaCalendario(c.fechaInicio) : null,
        c.fechaFin ? aDiaCalendario(c.fechaFin) : null
      )
    ) {
      throw errorHttp(400, `El rango se superpone con "${c.nombre}" (${fmtRango(c)})`);
    }
  }
}

/** Día vacío cuando ninguna configuración aplica. */
function diaVacio(fecha: string): ResolucionDiaDTO {
  return {
    fecha,
    configuracionId: null,
    numero: null,
    numeroInactiva: null,
    nombre: null,
    bloqueado: false,
    horarios: [],
  };
}

/**
 * Resuelve qué configuración aplica a cada día del rango [desde, hasta]
 * (inclusive, cap 400 días validado en la ruta).
 *
 * Incluye archivadas: `resolverConfiguracion` de @parapente/shared las ignora
 * para hoy/futuro y las incluye para fechas pasadas → el calendario histórico
 * nunca pierde su configuración (snapshot).
 *
 * La numeración viene de `numerarConfigs` sobre las NO archivadas; si la
 * ganadora de un día pasado es archivada se numera al final para que el
 * histórico también muestre etiqueta.
 */
export async function resolverRango(
  desde: string,
  hasta: string
): Promise<Record<string, ResolucionDiaDTO>> {
  const configs = await prisma.configuracionBloque.findMany({
    where: { deletedAt: null }, // incluye archivadas (snapshot histórico)
    include: { horarios: true },
    orderBy: { createdAt: 'asc' },
  });

  // Numeración en dos espacios de nombres que no colisionan:
  // vigentes → #1, #2… · archivadas → #IN1, #IN2… (solo aparecen en días pasados).
  const numeros = numerarConfigs(configs);

  const resultado: Record<string, ResolucionDiaDTO> = {};
  const cursor = new Date(`${desde}T00:00:00.000Z`);
  const fin = new Date(`${hasta}T00:00:00.000Z`);

  while (cursor <= fin) {
    const dia = cursor.toISOString().slice(0, 10);
    const ganadora = resolverConfiguracion(configs, dia);

    if (!ganadora) {
      resultado[dia] = diaVacio(dia);
    } else {
      const entrada = ganadora.id != null ? numeros.get(ganadora.id) : undefined;
      resultado[dia] = {
        fecha: dia,
        configuracionId: ganadora.id ?? null,
        numero: entrada && !entrada.archivada ? entrada.numero : null,
        numeroInactiva: entrada?.archivada ? entrada.numero : null,
        nombre: ganadora.nombre,
        bloqueado: Boolean(ganadora.bloqueado),
        horarios: (ganadora.horarios ?? []).map((h) => ({
          horaInicio: h.horaInicio,
          horaFin: h.horaFin,
        })),
      };
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return resultado;
}
