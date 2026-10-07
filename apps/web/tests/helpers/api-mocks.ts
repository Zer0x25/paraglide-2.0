import { Page } from '@playwright/test';

export interface UserMock {
  id?: number;
  email?: string;
  nombre?: string;
  role?: 'ADMIN' | 'RECEPCION' | 'PILOTO';
}

// Mocks comunes requeridos por AppShell y warmupData en TODAS las páginas:
// Evita fugas hacia el puerto 3001 y 401s inesperados.
export async function mockAppShellApi(page: Page) {
  // Red de seguridad: cualquier endpoint /api no mockeado explícitamente
  // responde neutro en vez de fugarse al backend real. Un 401 real con el
  // JWT fake de los mocks disparía el interceptor (borra la cookie +
  // redirect a /login) y haría flaky toda la suite DOM.
  // Nota: se excluye /api/auth/login (lo mockea mockLoginApi y este catch-all
  // se registra después: Playwright prioriza el último registrado) y
  // /api/public/ (vistas sin sesión: no pueden disparar el 401 que borra la
  // cookie, y specs dependen de su respuesta real en voucher/deslinde).
  await page.route(
    url => url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/login') && !url.pathname.startsWith('/api/public/'),
    async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          json: {
            data: [],
            pagination: { page: 1, pageSize: 500, total: 0, totalPages: 0, hasMore: false }
          }
        });
      } else {
        await route.fulfill({ status: 200, json: {} });
      }
    }
  );

  await page.route('**/api/meteorologia/estado-actual', async route => {
    await route.fulfill({
      status: 200,
      json: { velocidadViento: 12, rachas: 20, estado: 'APTO' }
    });
  });

  await page.route('**/api/meteorologia/historial*', async route => {
    await route.fulfill({
      status: 200,
      json: [
        { id: 1, fecha: new Date().toISOString(), velocidadViento: 12, rachas: 20, visibilidad: 5000, estado: 'APTO' }
      ]
    });
  });

  await page.route('**/api/meteorologia/pronostico-openmeteo*', async route => {
    await route.fulfill({
      status: 200,
      json: {
        hourly: {
          time: [new Date().toISOString()],
          wind_speed_10m: [12],
          wind_gusts_10m: [20],
          wind_direction_10m: [180]
        }
      }
    });
  });

  await page.route('**/api/modules', async route => {
    await route.fulfill({
      status: 200,
      json: {
        modules: ['equipos', 'reportes', 'meteorologia', 'pantalla', 'plantillas'].map((id) => ({ id, enabled: true }))
      }
    });
  });

  // Dashboard stats
  await page.route('**/api/dashboard/stats', async route => {
    await route.fulfill({
      status: 200,
      json: {
        pilotos: 3,
        pilotosActivos: 3,
        pilotosDisponiblesHoy: 2,
        pasajeros30d: 10,
        promedioDiarioPasajeros: '1.5',
        vuelosTotal: 24,
        vuelosHoy: 4,
        vuelosFuturos: 8,
        reservasRecientes: []
      }
    });
  });

  await page.route('**/api/agent/status', async route => {
    await route.fulfill({
      status: 200,
      json: {
        status: 'ready',
        provider: 'gemini',
        model: 'gemini-3.1-flash-lite',
        hasApiKey: true,
        totalTools: 6,
        capabilities: []
      }
    });
  });

  // Configuración de bloques de vuelo y horarios
  await page.route('**/api/configuracion-bloques/resolver*', async route => {
    await route.fulfill({ status: 200, json: [] });
  });

  await page.route('**/api/configuracion-bloques*', async route => {
    await route.fulfill({ status: 200, json: [] });
  });

  // Disponibilidad de pilotos
  await page.route('**/api/pilotos/*/disponibilidad*', async route => {
    await route.fulfill({
      status: 200,
      json: { turnos: [], turnosBloqueados: [], excepciones: [] }
    });
  });

  // Warmup data & catálogos secundarios
  await page.route('**/api/equipos*', async route => {
    await route.fulfill({
      status: 200,
      json: { data: [], pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1, hasMore: false } }
    });
  });

  await page.route('**/api/plantillas*', async route => {
    await route.fulfill({
      status: 200,
      json: { data: [], pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1, hasMore: false } }
    });
  });

  await page.route('**/api/empresa*', async route => {
    await route.fulfill({
      status: 200,
      json: { nombre: 'Parapente E2E School', email: 'contacto@parapente.cl', telefono: '+56911112222' }
    });
  });

  await page.route('**/api/faqs*', async route => {
    await route.fulfill({ status: 200, json: [] });
  });

  await page.route('**/api/reglas-operativas*', async route => {
    await route.fulfill({
      status: 200,
      json: [
        { clave: 'puntoDeEncuentro', valor: 'Zona de Despegue Principal', categoria: 'PUNTO_ENCUENTRO', esDefault: true }
      ]
    });
  });

  await page.route('**/api/tarifas*', async route => {
    await route.fulfill({
      status: 200,
      json: { data: [], pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1, hasMore: false } }
    });
  });

  await page.route('**/api/promociones*', async route => {
    await route.fulfill({
      status: 200,
      json: { data: [], pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1, hasMore: false } }
    });
  });

  await page.route('**/api/deslindes*', async route => {
    await route.fulfill({
      status: 200,
      json: { data: [], pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1, hasMore: false } }
    });
  });

  await page.route('**/api/eventos*', async route => {
    await route.fulfill({
      status: 200,
      json: { data: [], pagination: { page: 1, pageSize: 500, total: 0, totalPages: 1, hasMore: false } }
    });
  });
}

export async function mockLoginApi(page: Page, userOverride?: UserMock) {
  const user = {
    id: userOverride?.id ?? 1,
    email: userOverride?.email ?? 'admin@parapente.com',
    nombre: userOverride?.nombre ?? 'Administrador E2E',
    role: userOverride?.role ?? 'ADMIN'
  };

  await page.route('**/api/auth/login', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: {
        token: `jwt-e2e-${user.role.toLowerCase()}-token`,
        user
      }
    });
  });
}

export async function login(page: Page, creds?: { email?: string; password?: string }) {
  await page.goto('/login');
  await page.fill('input[name="email"]', creds?.email ?? 'admin@parapente.com');
  await page.fill('input[name="password"]', creds?.password ?? 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.pathname === '/');
}

// Contrato de listados (ADR 005): envelope { data, pagination }.
// `urlPattern` debe incluir `*` si la app pasa query params (desde/hasta, pageSize...).
export async function mockLista(page: Page, urlPattern: string, items: unknown[]) {
  await page.route(urlPattern, async route => {
    await route.fulfill({
      status: 200,
      json: {
        data: items,
        pagination: { page: 1, pageSize: 500, total: items.length, totalPages: 1, hasMore: false }
      }
    });
  });
}