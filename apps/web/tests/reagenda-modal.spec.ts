import { test, expect } from '@playwright/test';
import { mockLoginApi, mockAppShellApi, mockLista } from './helpers/api-mocks';

test.describe('Reagendamiento y Modificación de Vuelos en Calendario (Concurrencia & Version)', () => {
  const hoyIso = new Date().toISOString();

  test.beforeEach(async ({ page }) => {
    await mockLoginApi(page);
    await mockAppShellApi(page);

    await mockLista(page, '**/api/pilotos*', [
      { id: 1, nombre: 'Piloto Titular', activo: true, tieneLicencia: true, disponibilidadTotal: true },
      { id: 2, nombre: 'Piloto Reemplazo', activo: true, tieneLicencia: true, disponibilidadTotal: true }
    ]);

    await mockLista(page, '**/api/pasajeros*', [
      { id: 10, nombre: 'Pasajero Reagenda', peso: 72, firmaDeslinde: true, reservaId: 5 }
    ]);

    await mockLista(page, '**/api/reservas*', [
      {
        id: 5,
        numeroReserva: 'RES-MOD-005',
        nombreTitular: 'Carlos Reagenda',
        telefono: '+56911223344',
        email: 'carlos@reagenda.com',
        estadoPago: 'PAGADO',
        valorTotal: 65000,
        abono: 65000,
        fechaReserva: hoyIso,
        pasajeros: []
      }
    ]);

    await mockLista(page, '**/api/vuelos*', [
      {
        id: 88,
        fechaHora: hoyIso,
        valorPactado: 65000,
        estado: 'AGENDADO',
        pilotoId: 1,
        pasajeroId: 10,
        version: 3,
        pasajero: {
          id: 10,
          nombre: 'Pasajero Reagenda'
        },
        piloto: {
          id: 1,
          nombre: 'Piloto Titular'
        }
      }
    ]);
  });

  test('1. Abre modal de edición desde Vista Agenda, cambia piloto preservando versión y guarda cambios', async ({ page }) => {
    let putPayload: Record<string, unknown> | null = null;

    await page.route('**/api/vuelos/88', async route => {
      if (route.request().method() === 'PUT') {
        putPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          json: {
            id: 88,
            fechaHora: hoyIso,
            valorPactado: 65000,
            estado: 'AGENDADO',
            pilotoId: 2,
            pasajeroId: 10,
            version: 4
          }
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname === '/');

    await page.goto('/calendario');
    await expect(page.locator('.rbc-calendar')).toBeVisible();

    // Cambiar a Vista Agenda para ver la tarjeta del piloto
    const btnVistaAgenda = page.getByRole('button', { name: /Vista Agenda/i });
    await expect(btnVistaAgenda).toBeVisible();
    await btnVistaAgenda.click();

    // Localizar y hacer click en la tarjeta del vuelo
    const flightCard = page.getByLabel('Editar reserva de Pasajero Reagenda');
    await expect(flightCard).toBeVisible();
    await flightCard.click();

    // El modal debe abrirse en modo edición
    const modalHeader = page.getByRole('heading', { name: 'Editar Vuelo' });
    await expect(modalHeader).toBeVisible();

    // Cambiar el piloto a Piloto Reemplazo (id: 2)
    const pilotoSelect = page.locator('#vuelo-piloto');
    await expect(pilotoSelect).toBeVisible();
    await pilotoSelect.selectOption('2');

    // Guardar cambios
    const btnGuardar = page.getByRole('button', { name: /Guardar Cambios/i });
    await expect(btnGuardar).toBeEnabled();
    await btnGuardar.click();

    // Verificar notificación de éxito
    await expect(page.getByText(/¡Vuelo actualizado con éxito!/i)).toBeVisible();

    // Verificar que la petición envió la versión original (3) y el nuevo piloto (2)
    const sent = putPayload as Record<string, unknown> | null;
    expect(sent).not.toBeNull();
    expect(sent?.['version']).toBe(3);
    expect(sent?.['pilotoId']).toBe(2);
  });
});
