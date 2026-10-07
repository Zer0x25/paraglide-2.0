export interface PilotoFeed {
  id: number;
  nombre: string;
  categoria: string;
  token: string;
  /** ISO-8601: expiración del token de suscripción (emisión + 1 año). */
  expiraEn?: string;
  httpUrl: string;
  webcalUrl: string;
}

export interface SyncInfo {
  universal: {
    token: string;
    /** ISO-8601: expiración del token de suscripción (emisión + 1 año). */
    expiraEn?: string;
    httpUrl: string;
    webcalUrl: string;
    googleCalendarUrl: string;
  };
  pilotos: PilotoFeed[];
  googleCalendar?: {
    enabled: boolean;
    calendarId: string | null;
    oneClickSubscribeUrl: string | null;
  };
}
