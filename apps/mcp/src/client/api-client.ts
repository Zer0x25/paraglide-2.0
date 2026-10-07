import { mcpConfig } from '../config';

export class ParaglideApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl = mcpConfig.apiUrl, apiKey = mcpConfig.apiKey) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      const errorMsg = typeof data === 'object' && data !== null && 'message' in data
        ? (data as any).message
        : typeof data === 'string' && data
        ? data
        : `HTTP Error ${res.status}: ${res.statusText}`;

      const err: any = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data as T;
  }

  // --- METEOROLOGÍA ---
  async getMeteorologia() {
    return this.request<any>('/meteorologia/estado-actual');
  }

  // --- BLOQUES Y DISPONIBILIDAD ---
  async getConfiguracionesBloques() {
    return this.request<any[]>('/configuracion-bloques');
  }

  async resolverBloques(desde: string, hasta: string) {
    return this.request<Record<string, any>>(`/configuracion-bloques/resolver?desde=${desde}&hasta=${hasta}`);
  }

  async getVuelos(query: { desde?: string; hasta?: string; estado?: string; campos?: string } = {}) {
    const params = new URLSearchParams();
    if (query.desde) params.set('desde', query.desde);
    if (query.hasta) params.set('hasta', query.hasta);
    if (query.estado) params.set('estado', query.estado);
    if (query.campos) params.set('campos', query.campos);
    return this.request<{ data: any[]; pagination?: any } | { items: any[]; total: number } | any[]>(`/vuelos?${params.toString()}`);
  }

  async getPilotos() {
    return this.request<{ data: any[]; pagination?: any } | any[]>('/pilotos');
  }

  // --- TARIFAS ---
  // Contrato real de POST /reservas/calcular-valor (CalcularValorPayloadSchema):
  // solo tarifaId/promocionId/cantidadPasajeros. No aceptar parámetros extra
  // que el servidor ignoraría en silencio.
  async calcularTarifa(payload: {
    tarifaId?: number;
    promocionId?: number;
    cantidadPasajeros: number;
  }) {
    return this.request<any>('/reservas/calcular-valor', {
      method: 'POST',
      body: JSON.stringify({
        tarifaId: payload.tarifaId ?? 1,
        promocionId: payload.promocionId,
        cantidadPasajeros: payload.cantidadPasajeros,
      }),
    });
  }

  // --- RESERVAS ---
  async getReserva(id: number) {
    return this.request<any>(`/reservas/${id}`);
  }

  async listarReservas(query: { q?: string; estado?: string; desde?: string; hasta?: string; page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.estado) params.set('estado', query.estado);
    if (query.desde) params.set('desde', query.desde);
    if (query.hasta) params.set('hasta', query.hasta);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));
    return this.request<{ data: any[]; pagination?: any } | { items: any[]; total: number; page: number; pageSize: number; totalPages: number } | any[]>(`/reservas?${params.toString()}`);
  }

  async crearReserva(payload: any) {
    return this.request<any>('/reservas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelarReserva(id: number, payload?: string | { motivo: string; version?: number; devolucion?: any }) {
    const body = typeof payload === 'string'
      ? { motivo: payload || 'Cancelada vía agente MCP' }
      : { ...(payload || {}), motivo: payload?.motivo || 'Cancelada vía agente MCP' };
    return this.request<any>(`/reservas/${id}/cancelar`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async desagendarReserva(id: number, payload: { version?: number } = {}) {
    return this.request<any>(`/reservas/${id}/desagendar`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- CONSULTAS PÚBLICAS Y RECEPCIÓN ---
  async getFaqs() {
    return this.request<any[]>('/public/faqs');
  }

  async getReglasOperativas() {
    return this.request<any[]>('/public/reglas-operativas');
  }

  async getEmpresa() {
    return this.request<any>('/public/empresa');
  }

  async getPromociones() {
    return this.request<{ data: any[] } | any[]>('/promociones');
  }

  // --- AGENDAMIENTO ---
  async agendarGrupo(payload: {
    reservaId: number;
    fechaHora: string;
    asignaciones?: Record<number, number>;
    valorPactadoPorPasajero?: number;
    version?: number;
  }) {
    return this.request<{ success: boolean; vuelos: any[] }>('/vuelos/agendamiento-grupo', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const apiClient = new ParaglideApiClient();
