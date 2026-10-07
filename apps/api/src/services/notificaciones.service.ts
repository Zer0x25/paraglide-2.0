import { prisma } from '../plugins/prisma';
import { plantillasService } from './plantillas.service';
import { toNum } from './money.util';
import { getNotificacionConfigSafe } from './notificacionConfig.service';

/**
 * NOTIFICACIONES — esqueleto Fase 5 (recordatorios 24h / 2h).
 *
 * Arquitectura lista para envío real vía Resend (email) / Twilio (WhatsApp/SMS)
 * cuando se configuren las env vars correspondientes. No se añaden dependencias
 * aún; el envío está en stub y solo loguea.
 *
 * Env vars futuras (no requeridas ahora):
 *  - RESEND_API_KEY / RESEND_FROM
 *  - TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM
 *
 * Cuando estén presentes, reemplazar el bloque `console.log` en `programarEnvios()`
 * por `await resend.emails.send(...)` / `twilioClient.messages.create(...)`.
 * Mantener `version` y `deletedAt` en las queries para no romper soft-delete
 * ni concurrencia optimista (ADR 006 / 004).
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Tipo de plantilla que dispara la notificación automatizada. */
export type TipoNotificacion = 'RECORDATORIO_24H' | 'AVISO_CLIMA_CANCELACION';

/**
 * Payload normalizado que se loguea / enviará por canal externo.
 * `version` es la del vuelo (concurrencia optimista); `valorPactado` ya pasó por `toNum`.
 */
export interface NotificacionPayload {
  vueloId: number;
  tipo: TipoNotificacion;
  canal: 'WHATSAPP' | 'EMAIL' | 'SMS';
  /** Fecha/hora del vuelo (UTC en DB). */
  fechaHora: Date;
  /** Versión del vuelo para control de concurrencia. */
  version: number;
  valorPactado: number;
  piloto: { id: number; nombre: string };
  pasajero: { id: number; nombre: string; telefono: string | null };
  reservaId: number | null;
  /** Variables inyectadas en la plantilla. */
  variables: Record<string, string>;
  /** Cuerpo ya renderizado (preview). */
  cuerpoRenderizado: string;
}

// Ventanas de disparo alrededor del objetivo (tolerancia de cron).
const VENTANA_24H_MS = 30 * 60 * 1000; // ±30 min alrededor de now+24h
const VENTANA_2H_MS = 15 * 60 * 1000; // ±15 min alrededor de now+2h

// ---------------------------------------------------------------------------
// Render — sin dependencia de plantillasService para tests unitarios
// ---------------------------------------------------------------------------

/**
 * Reemplaza `{{clave}}` en `plantilla` por `vars[clave]`.
 * Claves con meta-caracteres se escapan para no romper RegExp.
 * No lanza: claves faltantes se reemplazan por ''.
 */
export function renderPlantilla(plantilla: string, vars: Record<string, string>): string {
  let out = plantilla ?? '';
  for (const [k, v] of Object.entries(vars)) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`{{${esc}}}`, 'g'), v ?? '');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Query — vuelos próximos a notificar
// ---------------------------------------------------------------------------

/** Horas soportadas por el scheduler. Extender aquí si se añade 48h, etc. */
export type HorasNotificacion = 24 | 2;

/**
 * Busca vuelos que caen en la ventana de notificación.
 * - Solo `estado = AGENDADO` y `deletedAt = null` (soft-delete).
 * - Rango: [now+horas - ventana, now+horas + ventana].
 * - Orden por fechaHora asc, `take` acotado (máx 500, respeta ADR 005).
 * - Incluye piloto + pasajero (+ reserva para link público si existe).
 */
export type VueloNotificable = {
  id: number;
  fechaHora: Date;
  version: number;
  valorPactado: unknown;
  estado: string;
  piloto: { id: number; nombre: string };
  pasajero: {
    id: number;
    nombre: string;
    telefono: string | null;
    reservaId: number | null;
    reserva: { id: number; tokenPublico: string | null; shortId: string | null } | null;
  };
};

export async function buscarVuelosProximos(horas: HorasNotificacion): Promise<VueloNotificable[]> {
  if (horas !== 24 && horas !== 2) {
    throw new Error('horas debe ser 24 o 2');
  }
  const ahora = Date.now();
  const objetivoMs = ahora + horas * 60 * 60 * 1000;
  const ventanaMs = horas === 24 ? VENTANA_24H_MS : VENTANA_2H_MS;
  const desde = new Date(objetivoMs - ventanaMs);
  const hasta = new Date(objetivoMs + ventanaMs);

  const vuelos = (await prisma.vuelo.findMany({
    where: {
      deletedAt: null,
      estado: 'AGENDADO',
      fechaHora: { gte: desde, lte: hasta },
    },
    include: {
      piloto: { select: { id: true, nombre: true } },
      pasajero: {
        select: {
          id: true,
          nombre: true,
          telefono: true,
          reservaId: true,
          reserva: { select: { id: true, tokenPublico: true, shortId: true } },
        },
      },
    },
    orderBy: { fechaHora: 'asc' },
    take: 500,
  })) as unknown as VueloNotificable[];

  return vuelos;
}

// ---------------------------------------------------------------------------
// Helpers de variables por plantilla seed
// ---------------------------------------------------------------------------

function varsParaRecordatorio24h(v: VueloNotificable): Record<string, string> {
  const fecha = new Date(v.fechaHora).toLocaleDateString('es-CL');
  const hora = new Date(v.fechaHora).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  // Enlaces públicos solo con identificadores no secuenciales (tokenPublico/shortId).
  const reservaPublicId = v.pasajero.reserva?.tokenPublico || v.pasajero.reserva?.shortId || '';
  const linkVoucher = reservaPublicId ? `/voucher/${reservaPublicId}` : '';
  return {
    nombre: v.pasajero.nombre,
    fecha,
    hora,
    link_voucher: linkVoucher,
    // Compat con plantillas que aún usan link_deslinde / saldo
    link_deslinde: reservaPublicId ? `/deslinde/${reservaPublicId}` : '',
    saldo: String(toNum(v.valorPactado)),
  };
}

function varsParaAvisoClima(v: VueloNotificable): Record<string, string> {
  const fecha = new Date(v.fechaHora).toLocaleDateString('es-CL');
  return {
    nombre: v.pasajero.nombre,
    fecha,
  };
}

// ---------------------------------------------------------------------------
// programarEnvios — barrido stub (loggea, no envía)
// ---------------------------------------------------------------------------

export interface ResultadoProgramacion {
  ventana24h: { total: number; enviados: number };
  ventana2h: { total: number; enviados: number };
}

/**
 * Itera vuelos en ventana 24h y 2h y loguea el envío que haría.
 * - 24h → plantilla RECORDATORIO_24H
 * - 2h  → plantilla AVISO_CLIMA_CANCELACION (placeholder operativo; cuando haya
 *         integración meteo real se condicionará a pista CERRADA/PRECAUCION)
 *
 * Stub: no llama a Twilio/Resend. Cuando se configuren las env vars, reemplazar
 * los `console.log` por el cliente correspondiente. Tolerante a fallos: nunca lanza.
 */
export async function programarEnvios(): Promise<ResultadoProgramacion> {
  const resultado: ResultadoProgramacion = {
    ventana24h: { total: 0, enviados: 0 },
    ventana2h: { total: 0, enviados: 0 },
  };

  // 24h — respeta NotificacionConfig.recordatorio24hActivo
  let recordatorioActivo = true;
  try {
    recordatorioActivo = (await getNotificacionConfigSafe())?.recordatorio24hActivo ?? true;
  } catch {}
  if (!recordatorioActivo) {
    console.log('[notificaciones] RECORDATORIO_24H desactivado por configuración — se omite ventana 24h');
  } else {
    try {
      const vuelos24h = await buscarVuelosProximos(24);
      resultado.ventana24h.total = vuelos24h.length;
      const plantilla24h = await plantillasService.getByTipo('RECORDATORIO_24H').catch(() => null);
      const cuerpoBase24h = plantilla24h?.cuerpo ?? '¡Hola {{nombre}}! Te recordamos tu vuelo el {{fecha}} a las {{hora}}.';

      for (const v of vuelos24h) {
        const vars = varsParaRecordatorio24h(v);
        const cuerpo = renderPlantilla(cuerpoBase24h, vars);
        const payload: NotificacionPayload = {
          vueloId: v.id,
          tipo: 'RECORDATORIO_24H',
          canal: (plantilla24h?.canal as NotificacionPayload['canal']) ?? 'WHATSAPP',
          fechaHora: v.fechaHora,
          version: v.version ?? 0,
          valorPactado: toNum(v.valorPactado),
          piloto: v.piloto,
          pasajero: {
            id: v.pasajero.id,
            nombre: v.pasajero.nombre,
            telefono: v.pasajero.telefono,
          },
          reservaId: v.pasajero.reservaId,
          variables: vars,
          cuerpoRenderizado: cuerpo,
        };
        // STUB — envío real vía Resend/Twilio cuando existan env vars:
        // if (process.env.RESEND_API_KEY) await resend.emails.send({...})
        // if (process.env.TWILIO_ACCOUNT_SID) await twilio.messages.create({...})
        console.log(`[notificaciones][RECORDATORIO_24H] vuelo#${payload.vueloId} v${payload.version} → ${payload.pasajero.nombre} (${payload.pasajero.telefono ?? 'sin contacto'}) | ${payload.cuerpoRenderizado.slice(0, 120)}`);
        resultado.ventana24h.enviados += 1;
      }
    } catch (err) {
      console.warn('[notificaciones] fallo en ventana 24h:', err);
    }
  }

  // 2h — aviso operativo (respeta NotificacionConfig.avisoClimaActivo)
  let avisoActivo = true;
  try {
    avisoActivo = (await getNotificacionConfigSafe())?.avisoClimaActivo ?? true;
  } catch {}
  if (!avisoActivo) {
    console.log('[notificaciones] AVISO_CLIMA_CANCELACION desactivado por configuración — se omite ventana 2h');
  } else {
    try {
      const vuelos2h = await buscarVuelosProximos(2);
    resultado.ventana2h.total = vuelos2h.length;
    const plantilla2h = await plantillasService.getByTipo('AVISO_CLIMA_CANCELACION').catch(() => null);
    const cuerpoBase2h = plantilla2h?.cuerpo ?? 'Hola {{nombre}}, tu vuelo es hoy {{fecha}}. Confirma asistencia.';

    for (const v of vuelos2h) {
      const vars = varsParaAvisoClima(v);
      const cuerpo = renderPlantilla(cuerpoBase2h, vars);
      const payload: NotificacionPayload = {
        vueloId: v.id,
        tipo: 'AVISO_CLIMA_CANCELACION',
        canal: (plantilla2h?.canal as NotificacionPayload['canal']) ?? 'WHATSAPP',
        fechaHora: v.fechaHora,
        version: v.version ?? 0,
        valorPactado: toNum(v.valorPactado),
        piloto: v.piloto,
        pasajero: {
          id: v.pasajero.id,
          nombre: v.pasajero.nombre,
          telefono: v.pasajero.telefono,
        },
        reservaId: v.pasajero.reservaId,
        variables: vars,
        cuerpoRenderizado: cuerpo,
      };
        console.log(`[notificaciones][AVISO_2H] vuelo#${payload.vueloId} v${payload.version} → ${payload.pasajero.nombre} (${payload.pasajero.telefono ?? 'sin contacto'}) | ${payload.cuerpoRenderizado.slice(0, 120)}`);
        resultado.ventana2h.enviados += 1;
      }
    } catch (err) {
      console.warn('[notificaciones] fallo en ventana 2h:', err);
    }
  }

  if (resultado.ventana24h.total > 0 || resultado.ventana2h.total > 0) {
    console.log(`[notificaciones] programarEnvios resumen: 24h ${resultado.ventana24h.enviados}/${resultado.ventana24h.total} · 2h ${resultado.ventana2h.enviados}/${resultado.ventana2h.total}`);
  }

  return resultado;
}
