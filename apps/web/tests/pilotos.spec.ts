import { test, expect } from '@playwright/test';
import { mockLoginApi, mockAppShellApi } from './helpers/api-mocks';

test.describe('Gestión de Pilotos (E2E DOM)', () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginApi(page);
    await mockAppShellApi(page);

    await page.route('**/api/pilotos*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          json: {
            data: [
              { id: 1, nombre: 'Ana Martínez', categoria: 'MASTER', prioridad: 1, telefono: '+56911111111', activo: true, tieneLicencia: true, licenciaVencimiento: null, peso: 80, pesoMinimoPasajero: 50, pesoMaximoPasajero: 100 },
              { id: 2, nombre: 'Luis Pérez', categoria: 'SENIOR', prioridad: 2, telefono: '+56922222222', activo: true, tieneLicencia: true, licenciaVencimiento: null, peso: 75, pesoMinimoPasajero: 45, pesoMaximoPasajero: 110 },
              { id: 3, nombre: 'Carla Rojas', categoria: 'JUNIOR', prioridad: 3, telefono: '+56933333333', activo: false, tieneLicencia: false, licenciaVencimiento: null, peso: 70, pesoMinimoPasajero: 40, pesoMaximoPasajero: 90 }
            ],
            pagination: { page: 1, pageSize: 500, total: 3, totalPages: 1, hasMore: false }
          }
        });
      } else {
        await route.continue();
      }
    });
  });

  test('Lista pilotos, busca y abre modal de edición', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname === '/');

    await page.goto('/pilotos');
    await expect(page.locator('table').getByText('Ana Martínez')).toBeVisible();
    await expect(page.locator('table').getByText('Luis Pérez')).toBeVisible();

    await page.fill('input[placeholder="Buscar nombre, RUT, teléfono..."]', 'Luis');
    await expect(page.locator('table').getByText('Ana Martínez')).not.toBeVisible();
    await expect(page.locator('table').getByText('Luis Pérez')).toBeVisible();

    await page.fill('input[placeholder="Buscar nombre, RUT, teléfono..."]', '');
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByRole('heading', { name: 'Editar Piloto' })).toBeVisible();
  });

  test('Busqueda sin resultados muestra estado vacío', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname === '/');

    await page.goto('/pilotos');
    await page.fill('input[placeholder="Buscar nombre, RUT, teléfono..."]', 'zzz-no-existe');
    await expect(page.locator('table').getByText('Ana Martínez')).not.toBeVisible();
    await expect(page.locator('table').getByText('Luis Pérez')).not.toBeVisible();
    await expect(page.locator('table').getByText(/Sin resultados para la búsqueda/i)).toBeVisible();
  });
});