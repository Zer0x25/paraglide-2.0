export type OutboxMetodo = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OutboxEntry {
  id: string; // clientId UUID
  entidad: string; // p.ej. 'piloto', 'reserva'
  metodo: OutboxMetodo;
  url: string;
  payload?: unknown;
  versionEsperada?: number;
  createdAt: number;
  intentos: number;
  tempId?: number | string; // ID temporal de entidad creada offline para remapeo
}

export interface OutboxConflicto {
  id: string; // = entry.id
  entidad: string;
  metodo: OutboxMetodo;
  url: string;
  payload?: unknown;
  createdAt: number;
  error: string; // mensaje del 409 o fallo
  status?: number; // código HTTP (409, 400, etc.)
}
