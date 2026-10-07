/**
 * Zona horaria canónica oficial del sistema Paraglide.
 * Todas las operaciones de vuelo, bloques horarios y reservas ocurren
 * en esta zona horaria física.
 */
export const DEFAULT_TIMEZONE = 'America/Santiago';

const formatYMD = (d: Date, timeZone: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
  }
};

/**
 * Normaliza y devuelve la clave de fecha `YYYY-MM-DD` en la zona horaria canónica (default 'America/Santiago').
 * 
 * Reglas:
 * 1. Si fecha es falsy (null/undefined), usa la fecha actual en timeZone.
 * 2. Si fecha es un string 'YYYY-MM-DD' directo, extrae 'YYYY-MM-DD' sin conversiones UTC erráticas.
 * 3. Si fecha es un timestamp de medianoche ('YYYY-MM-DDT00:00:00...'), preserva el día civil original 'YYYY-MM-DD'.
 * 4. Si fecha es un Date o timestamp con hora específica, lo evalúa en timeZone.
 */
export const dateKeyLocal = (
  fecha?: Date | string | null,
  timeZone: string = DEFAULT_TIMEZONE
): string => {
  if (fecha === null || fecha === undefined) {
    fecha = new Date();
  }

  if (typeof fecha === 'string') {
    const trimmed = fecha.trim();
    // 1. Solo fecha: 'YYYY-MM-DD'
    const matchDateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
    if (matchDateOnly) {
      return matchDateOnly[1];
    }
    // 2. Timestamp de medianoche creado por DatePicker / toISOString sin hora ('YYYY-MM-DDT00:00:00...')
    const matchMidnightIso = /^(\d{4}-\d{2}-\d{2})T00:00:00(\.000)?Z?$/.exec(trimmed);
    if (matchMidnightIso) {
      return matchMidnightIso[1];
    }
  }

  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) {
    return formatYMD(new Date(), timeZone);
  }

  return formatYMD(d, timeZone);
};

/**
 * Extrae la hora local `HH:mm` (24h) en la zona horaria canónica.
 * Garantiza paridad absoluta si el runtime corre en UTC (Docker, CI) o en local.
 */
export const horaLocalHHMM = (
  fechaHora: string | Date | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): string => {
  if (!fechaHora) return '00:00';

  if (typeof fechaHora === 'string') {
    const trimmed = fechaHora.trim();
    // Si ya es un HH:mm simple (ej: '14:00' o '09:05')
    const matchHora = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
    if (matchHora) {
      return `${matchHora[1].padStart(2, '0')}:${matchHora[2]}`;
    }
  }

  const d = typeof fechaHora === 'string' ? new Date(fechaHora) : fechaHora;
  if (isNaN(d.getTime())) return '00:00';

  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(d);
  } catch {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
};

/**
 * ¿El ISO o fecha pertenece al día local `YYYY-MM-DD`?
 */
export const esMismoDia = (
  fechaHoraIso: string | Date,
  dateKey: string,
  timeZone: string = DEFAULT_TIMEZONE
): boolean => {
  if (!fechaHoraIso || !dateKey) return false;
  return dateKeyLocal(fechaHoraIso, timeZone) === dateKey;
};

/**
 * Convierte fecha 'YYYY-MM-DD' y hora 'HH:mm' en una zona horaria (default 'America/Santiago')
 * a una cadena ISO UTC ('YYYY-MM-DDTHH:mm:ss.sssZ').
 * Garantiza paridad absoluta tanto en el navegador como en servidores Node con TZ=UTC (Docker/CI).
 */
export const fechaHoraLocalToIso = (
  fecha: string,
  hora: string = '12:00',
  timeZone: string = DEFAULT_TIMEZONE
): string => {
  const cleanFecha = dateKeyLocal(fecha, timeZone);
  const cleanHora = horaLocalHHMM(hora || '12:00', timeZone);

  try {
    const dummyUtc = new Date(`${cleanFecha}T${cleanHora}:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    });
    const parts = formatter.formatToParts(dummyUtc);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    const match = tzPart?.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const mins = match[2] ? parseInt(match[2], 10) : 0;
      const sign = hours >= 0 ? '+' : '-';
      const offsetStr = `${sign}${String(Math.abs(hours)).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      return new Date(`${cleanFecha}T${cleanHora}:00${offsetStr}`).toISOString();
    }
  } catch {
    // fallback
  }
  return new Date(`${cleanFecha}T${cleanHora}:00`).toISOString();
};

/**
 * Formatea una fecha en español chileno de manera consistente y sin saltos de día.
 * Si recibe solo fecha 'YYYY-MM-DD' o un timestamp, lo proyecta en la zona horaria oficial.
 */
export const formatFechaEspanol = (
  fecha: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  timeZone: string = DEFAULT_TIMEZONE
): string => {
  if (!fecha) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
    ...options,
  };

  const ymd = dateKeyLocal(fecha, timeZone);
  const d = new Date(fechaHoraLocalToIso(ymd, '12:00', timeZone));

  try {
    return new Intl.DateTimeFormat('es-CL', defaultOptions).format(d);
  } catch {
    return ymd;
  }
};

/**
 * Parámetros para generar la URL oficial de Google Calendar.
 */
export interface GoogleCalendarEventParams {
  title: string;
  fecha: string | Date;
  hora?: string | null;
  duracionMinutos?: number;
  details?: string;
  location?: string;
  timeZone?: string;
}

/**
 * Construye URL oficial de Google Calendar para agendar un evento con hora local y TZ exacta.
 */
export const buildGoogleCalendarUrl = (params: GoogleCalendarEventParams): string => {
  const {
    title,
    fecha,
    hora,
    duracionMinutos = 45,
    details = '',
    location = '',
    timeZone = DEFAULT_TIMEZONE,
  } = params;

  const ymd = dateKeyLocal(fecha, timeZone);
  const horaInicio = hora && hora.trim() !== '' ? horaLocalHHMM(hora, timeZone) : '10:00';

  const isoInicio = fechaHoraLocalToIso(ymd, horaInicio, timeZone);
  const dInicio = new Date(isoInicio);
  const dFin = new Date(dInicio.getTime() + duracionMinutos * 60 * 1000);

  const formatGDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const datesParam = `${formatGDate(dInicio)}/${formatGDate(dFin)}`;

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', datesParam);
  if (details) url.searchParams.set('details', details);
  if (location) url.searchParams.set('location', location);
  url.searchParams.set('ctz', timeZone);

  return url.toString();
};


