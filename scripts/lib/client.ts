/**
 * Cliente HTTP tipado para suites E2E (Staging y Prod)
 * Maneja autenticación automática, headers canónicos y contrato de sobres ADR 005.
 */

import type { ApiRequestOptions, ApiResponse, EnvelopeList, SuiteConfig, SSEListener, SSEMessage } from './types';

const globalTokenCache = new Map<string, { token: string; tokenRole: string }>();
const globalLoginPromiseCache = new Map<string, Promise<string>>();

export class ApiTestClient {
  private baseUrl: string;
  private email: string;
  private password: string;
  private token: string | null = null;
  private tokenRole: string | null = null;

  constructor(config: SuiteConfig) {
    this.baseUrl = config.targetUrl.replace(/\/$/, '');
    this.email = config.adminEmail;
    this.password = config.adminPassword;
  }

  private get cacheKey(): string {
    return `${this.baseUrl}:${this.email}`;
  }

  /**
   * Obtiene o reutiliza el token administrativo (ADR 013 Single-Session).
   * Deduplica peticiones concurrentes y comparte la sesión entre suites para evitar
   * revocar sesiones activas y superar el límite de rate limit en /api/auth/login.
   */
  async getAuthToken(forceRefresh: boolean = false): Promise<string> {
    if (this.token && !forceRefresh) {
      return this.token;
    }

    if (!forceRefresh && globalTokenCache.has(this.cacheKey)) {
      const cached = globalTokenCache.get(this.cacheKey)!;
      this.token = cached.token;
      this.tokenRole = cached.tokenRole;
      return this.token;
    }

    if (!forceRefresh && globalLoginPromiseCache.has(this.cacheKey)) {
      return globalLoginPromiseCache.get(this.cacheKey)!;
    }

    const loginPromise = (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.email, password: this.password }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Fallo de login en ApiTestClient (${res.status}): ${errBody}`);
        }

        const data = (await res.json()) as { token: string; user?: { role: string } };
        this.token = data.token;
        this.tokenRole = data.user?.role || 'ADMIN';
        globalTokenCache.set(this.cacheKey, { token: this.token, tokenRole: this.tokenRole });
        return this.token;
      } finally {
        globalLoginPromiseCache.delete(this.cacheKey);
      }
    })();

    globalLoginPromiseCache.set(this.cacheKey, loginPromise);
    return loginPromise;
  }

  setToken(token: string | null, role: string = 'ADMIN') {
    this.token = token;
    this.tokenRole = role;
    if (token) {
      globalTokenCache.set(this.cacheKey, { token, tokenRole: role });
    } else {
      globalTokenCache.delete(this.cacheKey);
    }
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    return url.toString();
  }

  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: any,
    options?: ApiRequestOptions
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options?.headers || {}),
    };

    if (body !== undefined && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (!options?.skipAuth) {
      const token = options?.token || (await this.getAuthToken());
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    });

    // Reintento automático en caso de revocación de sesión por ADR 013 (401)
    if (res.status === 401 && !options?.skipAuth && !options?.token) {
      try {
        const freshToken = await this.getAuthToken(true);
        headers['Authorization'] = `Bearer ${freshToken}`;
        res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        });
      } catch {
        // Continuar con respuesta 401 original si el reintento falló
      }
    }

    let data: T;
    let rawText: string | undefined;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = (await res.json().catch(() => ({}))) as T;
    } else {
      rawText = await res.text().catch(() => '');
      data = rawText as unknown as T;
    }

    return {
      status: res.status,
      ok: res.ok,
      data,
      headers: res.headers,
      rawText,
    };
  }

  async get<T = any>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T = any>(path: string, body?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T = any>(path: string, body?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  async patch<T = any>(path: string, body?: any, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T = any>(path: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Helper para desempaquetar sobre ADR 005 ({ data: T[], pagination }).
   */
  unwrapList<Item = any>(res: ApiResponse<EnvelopeList<Item> | Item[]>): Item[] {
    if (!res.ok) {
      throw new Error(`No se puede desempaquetar respuesta errónea HTTP ${res.status}`);
    }

    if (Array.isArray(res.data)) {
      return res.data;
    }

    if (res.data && typeof res.data === 'object' && 'data' in res.data && Array.isArray(res.data.data)) {
      return res.data.data;
    }

    return [];
  }
}

export function createApiClient(config: SuiteConfig): ApiTestClient {
  return new ApiTestClient(config);
}

/**
 * Canjea el JWT por un ticket SSE de un solo uso (hallazgo 2b): el JWT ya no
 * viaja en la query string de la conexión SSE.
 */
async function solicitarTicketSse(baseUrl: string, token: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/eventos/ticket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Fallo al solicitar ticket SSE: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { ticket?: string; data?: { ticket?: string } };
  const ticket = body?.ticket ?? body?.data?.ticket;
  if (!ticket) {
    throw new Error('El servidor no devolvió un ticket SSE');
  }
  return ticket;
}

/**
 * Cliente SSE para suscripción a eventos en tiempo real (/api/eventos)
 */
export async function createSSEListener(client: ApiTestClient): Promise<SSEListener> {
  const token = await client.getAuthToken();
  const baseUrl = (client as any).baseUrl;
  const ticket = await solicitarTicketSse(baseUrl, token);
  const url = `${baseUrl}/api/eventos?ticket=${encodeURIComponent(ticket)}`;
  const controller = new AbortController();
  const receivedEvents: SSEMessage[] = [];

  (async () => {
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });

      if (!res.ok || !res.body) {
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          let eventType = 'message';
          let dataStr = '';

          for (const line of trimmed.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              dataStr = line.slice(6).trim();
            }
          }

          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              receivedEvents.push({ type: eventType, data, timestamp: Date.now() });
            } catch {
              receivedEvents.push({ type: eventType, data: dataStr, timestamp: Date.now() });
            }
          }
        }
      }
    } catch {
      // Abortado normalmente
    }
  })();

  await new Promise((r) => setTimeout(r, 150));

  return {
    events: receivedEvents,
    waitForEvent: (predicate: (ev: SSEMessage) => boolean, timeoutMs = 8000) => {
      return new Promise<SSEMessage>((resolve, reject) => {
        const start = Date.now();
        const check = () => {
          const found = receivedEvents.find(predicate);
          if (found) return resolve(found);
          if (Date.now() - start > timeoutMs) {
            return reject(new Error(`Timeout (${timeoutMs}ms) esperando evento SSE`));
          }
          setTimeout(check, 100);
        };
        check();
      });
    },
    close: () => {
      controller.abort();
    },
  };
}

