import { test, expect } from '@playwright/test';
import { mockLoginApi, mockAppShellApi } from './helpers/api-mocks';

test.describe('Envío manual WhatsApp desde Reservas (E2E DOM)', () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginApi(page);
    await mockAppShellApi(page);

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
                estadoPago: 'PAGADO',
                valorTotal: 60000,
                abono: 60000,
                fechaReserva: new Date().toISOString(),
                version: 0,
                pasajeros: [
                  {
                    id: 1,
                    nombre: 'Pasajero Con Teléfono',
                    rutDni: '12.345.678-9',
                    peso: 75,
                    telefono: '+56987654321',
                    firmaDeslinde: true,
                    vuelos: [
                      {
                        id: 10,
                        fechaHora: new Date(Date.now() + 86400000).toISOString(),
                        estado: 'AGENDADO',
                        pilotoId: 7,
                        piloto: {
                          id: 7,
                          nombre: 'Piloto WhatsApp',
                          telefono: '+56977777777',
                          activo: true
                        }
                      }
                    ]
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
  });

  test('Abre WhatsApp de confirmación al titular y del piloto asignado', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname === '/');

    await page.goto('/reservas');
    await expect(page.getByText('Pasajero Con Teléfono')).toBeVisible();

    // Confirmación grupal al titular (sustituye al antiguo botón por pasajero,
    // eliminado como duplicado en 2ff2f2c: el mensaje al titular cubre al grupo).
    const btnTitular = page.getByRole('button', { name: 'WhatsApp', exact: true });
    await expect(btnTitular).toBeVisible();
    const [popupTitular] = await Promise.all([
      page.waitForEvent('popup'),
      btnTitular.click()
    ]);
    const titularUrl = decodeURIComponent(popupTitular.url()).replace(/\+/g, ' ');
    expect(titularUrl).toContain('whatsapp.com');
    expect(titularUrl).toContain('56912345678');
    expect(titularUrl).toContain('Titular E2E');
    await popupTitular.close();

    await expect(page.getByText('Piloto WhatsApp')).toBeVisible();
    const btnPiloto = page.getByRole('button', { name: /Notificar por WhatsApp a Piloto WhatsApp/i });
    await expect(btnPiloto).toBeVisible();
    const [popupPiloto] = await Promise.all([
      page.waitForEvent('popup'),
      btnPiloto.click()
    ]);
    const pilotoUrl = decodeURIComponent(popupPiloto.url()).replace(/\+/g, ' ');
    expect(pilotoUrl).toContain('whatsapp.com');
    expect(pilotoUrl).toContain('56977777777');
    expect(pilotoUrl).toContain('Piloto WhatsApp');
    await popupPiloto.close();
  });
});