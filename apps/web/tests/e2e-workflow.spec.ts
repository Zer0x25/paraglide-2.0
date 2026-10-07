import { test, expect } from '@playwright/test';
import { mockAppShellApi, mockLista } from './helpers/api-mocks';

test.describe('Flujo Operativo Completo E2E (Reserva -> Deslinde -> Navegación -> Analíticas)', () => {
  
  test.beforeEach(async ({ page }) => {
    await mockAppShellApi(page);
    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          token: 'jwt-e2e-test-token',
          user: { id: 1, email: 'admin@parapente.com', nombre: 'Administrador E2E', role: 'ADMIN' }
        }
      });
    });

    // Analíticas carga /api/metricas/financiero al entrar; sin mock el API
    // real responde 401 con el token falso -> el interceptor borra la sesión
    // y redirige a /login
    await page.route('**/api/metricas**', async route => {
      await route.fulfill({
        status: 200,
        json: {
          mes: 7,
          year: 2026,
          totalAgendados: 10,
          totalCompletados: 8,
          totalCancelados: 2,
          ingresosTotales: 400000,
          pagosPilotos: 120000,
          gastosOperativos: 50000,
          pagoEscuela: 80000,
          margenNetoPorcentaje: 30,
          pilotosTop: [],
          demandaMensual: [],
          gastosPorCategoria: []
        }
      });
    });

    await mockLista(page, '**/api/pilotos*', [
      { id: 1, nombre: 'Piloto E2E 1', activo: true, tieneLicencia: true, disponibilidadTotal: true }
    ]);

    await mockLista(page, '**/api/pasajeros*', [
      { id: 1, nombre: 'Pasajero E2E', peso: 70, firmaDeslinde: false, reservaId: 1 }
    ]);

    await mockLista(page, '**/api/vuelos*', [
      { id: 1, fechaHora: new Date().toISOString(), valorPactado: 50000, estado: 'AGENDADO', pilotoId: 1, pasajeroId: 1 }
    ]);

    await page.route('**/api/reservas*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          json: {
            data: [
              {
                id: 1,
                numeroReserva: 'RES-E2E-001',
                nombreTitular: 'Titular E2E',
                telefono: '+56912345678',
                email: 'titular@e2e.com',
                estadoPago: 'ABONADO',
                valorTotal: 60000,
                abono: 20000,
                fechaReserva: new Date().toISOString(),
                pasajeros: [
                  {
                    id: 1,
                    nombre: 'Pasajero E2E Test',
                    rutDni: '12.345.678-9',
                    peso: 75,
                    contactoEmergencia: 'Familiar E2E',
                    telefonoEmergencia: '+56987654321',
                    condicionFisica: 'Óptima',
                    firmaDeslinde: false,
                    vuelos: []
                  }
                ]
              }
            ],
            pagination: { page: 1, pageSize: 500, total: 1, totalPages: 1, hasMore: false }
          }
        });
      } else {
        await route.continue();
      }
    });

    await page.route('**/api/pasajeros/1/firma', async route => {
      await route.fulfill({
        status: 200,
        json: {
          id: 1,
          nombre: 'Pasajero E2E Test',
          firmaDeslinde: true,
          firmaFecha: new Date().toISOString()
        }
      });
    });
  });

  test('1. Iniciar sesión e ingresar al Panel Principal', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForURL(url => url.pathname === '/');
    // (rol heading: evita la ambigüedad con el route announcer de Next.js)
    await expect(page.getByRole('heading', { name: 'Panel de Control' })).toBeVisible();
    await expect(page.getByText('Vuelos de Hoy')).toBeVisible();
  });

  test('2. Gestión de Reservas y Firma Digital de Deslinde', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname === '/');

    await page.goto('/reservas');
    await expect(page.getByRole('heading', { name: 'Gestión de Reservas y Pasajeros' })).toBeVisible();

    await expect(page.getByText('Pasajero E2E Test')).toBeVisible();
    const btnFirmar = page.getByRole('button', { name: /Firmar en Pista/i });
    await expect(btnFirmar).toBeVisible();

    await btnFirmar.click();
    await expect(page.getByText('Deslinde de Responsabilidad')).toBeVisible();

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 50);
      await page.mouse.move(box.x + 150, box.y + 20);
      await page.mouse.up();
    }

    const btnConfirmar = page.getByRole('button', { name: /Confirmar y Firmar/i });
    await expect(btnConfirmar).toBeEnabled();
    await btnConfirmar.click();

    await expect(page.getByText('Deslinde de Responsabilidad')).not.toBeVisible();
  });

  test('3. Navegación a Calendario y Analíticas', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname === '/');

    await page.goto('/calendario');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/.*calendario/);

    await page.goto('/analiticas');
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/.*analiticas/);
  });
});
