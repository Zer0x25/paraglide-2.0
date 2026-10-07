import { test, expect } from '@playwright/test';
import { mockLoginApi, mockAppShellApi, mockLista, login } from './helpers/api-mocks';

test.describe('Resiliencia Offline y Mutaciones Outbox (E2E Playwright)', () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginApi(page);
    await mockAppShellApi(page);

    await mockLista(page, '**/api/pilotos*', [
      { id: 1, nombre: 'Piloto Offline 1', activo: true, tieneLicencia: true, disponibilidadTotal: true },
    ]);

    await mockLista(page, '**/api/pasajeros*', [
      { id: 201, nombre: 'Pasajero Previo', peso: 72, firmaDeslinde: true, reservaId: 101 },
    ]);

    await mockLista(page, '**/api/vuelos*', [
      { id: 301, fechaHora: new Date().toISOString(), valorPactado: 60000, estado: 'AGENDADO', pilotoId: 1, pasajeroId: 201 },
    ]);

    await page.route('**/api/reservas*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          json: {
            data: [
              {
                id: 101,
                numeroReserva: 'RES-OFFLINE-001',
                nombreTitular: 'Titular Previo',
                telefono: '+56911223344',
                email: 'previo@test.com',
                estadoPago: 'ABONADO',
                valorTotal: 70000,
                abono: 20000,
                fechaReserva: new Date().toISOString(),
                version: 0,
                pasajeros: [
                  {
                    id: 201,
                    nombre: 'Pasajero Previo',
                    peso: 72,
                    firmaDeslinde: true,
                    vuelos: [],
                  },
                ],
              },
            ],
            pagination: { page: 1, pageSize: 500, total: 1, totalPages: 1, hasMore: false },
          },
        });
      } else {
        await route.continue();
      }
    });
  });

  test('debe encolar reserva en outbox silenciosamente y mostrar toast informativo cuando falla la red', async ({ page }) => {
    await login(page);

    await page.goto('/reservas');
    await page.waitForLoadState('domcontentloaded');

    // Verificar que la página de reservas cargó con el dato mockeado
    await expect(page.getByText('RES-OFFLINE-001')).toBeVisible({ timeout: 10000 });

    // Abrir modal de nueva reserva
    const btnNueva = page.getByRole('button', { name: /Nueva Reserva/i });
    await btnNueva.waitFor({ state: 'visible' });
    await btnNueva.click();

    // Validar apertura del modal
    await expect(page.getByText('Crear Nueva Reserva')).toBeVisible({ timeout: 5000 });

    // Completar campos mínimos
    await page.fill('input[name="nombreTitular"]', 'Titular Offline Test');
    await page.fill('input[name="telefono"]', '+56999887766');
    await page.fill('input[name="pasajeros.0.nombre"]', 'Pasajero Offline 1');
    await page.fill('input[name="pasajeros.0.peso"]', '78');

    // Interceptar llamadas POST para simular fallo de red (offline)
    await page.route('**/api/reservas', async (route) => {
      if (route.request().method() === 'POST') {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    // Enviar el formulario
    const btnGuardar = page.getByRole('button', { name: /Crear Reserva/i });
    await btnGuardar.click();

    // Debe capturar el error como queued y cerrar el modal sin romper la UI (ADR 009)
    await expect(page.getByText('Crear Nueva Reserva')).not.toBeVisible({ timeout: 8000 });

    // Debe mostrar el toast informativo de outbox (ADR 009)
    await expect(
      page.getByText('Sin conexión: la reserva se guardó localmente').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('debe encolar eliminación de reserva en outbox cuando no hay red', async ({ page }) => {
    await login(page);

    await page.goto('/reservas');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByText('RES-OFFLINE-001')).toBeVisible({ timeout: 10000 });

    // Interceptar DELETE para simular corte de red
    await page.route('**/api/reservas/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    // Clic en botón eliminar (ícono papelera)
    const btnEliminar = page.locator('button[title*="Eliminar"], button[aria-label*="Eliminar"]').first();
    if (await btnEliminar.isVisible()) {
      await btnEliminar.click();

      // Si se abre confirmación
      const btnConfirmar = page.getByRole('button', { name: /Eliminar/i }).last();
      if (await btnConfirmar.isVisible()) {
        await btnConfirmar.click();
      }

      // Validar toast de eliminación encolada
      await expect(
        page.getByText('Sin conexión: la eliminación se sincronizará').first()
      ).toBeVisible({ timeout: 8000 });
    }
  });
});
