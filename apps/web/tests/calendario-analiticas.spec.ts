import { test, expect } from '@playwright/test';
import { mockLoginApi, mockAppShellApi, mockLista } from './helpers/api-mocks';

test.describe('Calendario y Analíticas (E2E DOM)', () => {
  test.beforeEach(async ({ page }) => {
    await mockLoginApi(page);
    await mockAppShellApi(page);

    await mockLista(page, '**/api/vuelos*', [
      { id: 1, fechaHora: new Date().toISOString(), valorPactado: 50000, estado: 'AGENDADO', pilotoId: 1, pasajeroId: 1, version: 0 }
    ]);

    await mockLista(page, '**/api/pilotos*', [
      { id: 1, nombre: 'Piloto E2E', activo: true, tieneLicencia: true, disponibilidadTotal: true }
    ]);

    await mockLista(page, '**/api/pasajeros*', [
      { id: 1, nombre: 'Pasajero E2E', peso: 70, firmaDeslinde: false, reservaId: 1 }
    ]);

    await mockLista(page, '**/api/reservas*', [
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
        pasajeros: []
      }
    ]);

    await page.route('**/api/configuracion-bloques', async route => {
      await route.fulfill({
        status: 200,
        json: []
      });
    });

    await page.route('**/api/metricas/financiero*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          ingresosTotales: 1200000,
          pagosPilotos: 480000,
          gastosOperativos: 150000,
          pagoEscuela: 570000,
          margenNetoPorcentaje: 47.5,
          totalCompletados: 24,
          demandaMensual: [
            { dia: 1, agendados: 2, completados: 1, cancelados: 0 },
            { dia: 2, agendados: 3, completados: 2, cancelados: 1 }
          ],
          gastosPorCategoria: [{ categoria: 'Combustible', monto: 90000 }],
          pilotosTop: [{ id: 1, nombre: 'Piloto Top', vuelos: 12, comisiones: 240000 }]
        }
      });
    });
  });

  test('Calendario renderiza vista mensual y permite alternar a vista agenda', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname === '/');

    await page.goto('/calendario');
    await expect(page.locator('.rbc-calendar')).toBeVisible();
    await expect(page.locator('.rbc-toolbar')).toBeVisible();

    const btnVistaAgenda = page.getByRole('button', { name: /Vista Agenda/i });
    await expect(btnVistaAgenda).toBeVisible();
    await btnVistaAgenda.click();
    await expect(page.getByRole('button', { name: /Vista Mensual/i })).toBeVisible();
  });

  test('Analíticas muestra KPIs y desglose de gastos', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(url => url.pathname === '/');

    await page.goto('/analiticas');
    await expect(page.getByText('Ingresos Totales')).toBeVisible();
    await expect(page.getByText('Pagos a Pilotos')).toBeVisible();
    await expect(page.getByText('Gastos Operativos', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Desglose de Gastos Operativos' })).toBeVisible();
    await expect(page.getByText('Combustible').first()).toBeVisible();
  });
});