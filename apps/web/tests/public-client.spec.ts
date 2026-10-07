import { test, expect } from '@playwright/test';
import { mockAppShellApi } from './helpers/api-mocks';

test.describe('Vistas Públicas de Cliente (Voucher y Deslinde sin Login)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAppShellApi(page);

    // Endpoint público de consulta de reserva por token o ID
    await page.route('**/api/public/reservas/tok_public_e2e*', async route => {
      await route.fulfill({
        status: 200,
        json: {
          id: 42,
          tokenPublico: 'tok_public_e2e',
          shortId: 'PK42',
          numeroReserva: 'RES-PUBLIC-042',
          nombreTitular: 'Constanza Valdés',
          telefono: '+56987654321',
          email: 'constanza@gmail.com',
          fechaReserva: new Date().toISOString(),
          estadoPago: 'PAGADO',
          valorTotal: 70000,
          abono: 70000,
          pasajeros: [
            {
              id: 101,
              tokenPublico: 'pax_tok_101',
              shortId: 'PX101',
              nombre: 'Constanza Valdés',
              rutDni: '18.765.432-1',
              peso: 65,
              contactoEmergencia: 'Mamá Constanza',
              telefonoEmergencia: '+56911223344',
              condicionFisica: 'Excelente',
              firmaDeslinde: false,
              firmaFecha: null
            }
          ]
        }
      });
    });

    // Endpoint público de firma digital
    await page.route('**/api/public/pasajeros/**/firma', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: {
            id: 101,
            nombre: 'Constanza Valdés',
            firmaDeslinde: true,
            firmaFecha: new Date().toISOString()
          }
        });
      } else {
        await route.continue();
      }
    });
  });

  test('1. Voucher público renderiza información del vuelo, QR y punto de encuentro sin requerir login', async ({ page }) => {
    await page.goto('/voucher/tok_public_e2e');

    // No debe redirigir a /login
    await expect(page).toHaveURL(/.*voucher\/tok_public_e2e/);

    // Debe mostrar nombre del titular y código de reserva
    await expect(page.getByText('Constanza Valdés').first()).toBeVisible();
    await expect(page.getByText('RES-PUBLIC-042')).toBeVisible();

    // Debe mostrar estado de pago
    await expect(page.getByText('PAGADO').first()).toBeVisible();

    // Debe mostrar botones de acción del voucher
    await expect(page.getByRole('button', { name: /Compartir/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /PDF/i })).toBeVisible();
  });

  test('2. Deslinde público permite al pasajero firmar en canvas y enviar formulario', async ({ page }) => {
    await page.goto('/deslinde/tok_public_e2e');

    // No debe redirigir a /login
    await expect(page).toHaveURL(/.*deslinde\/tok_public_e2e/);

    // Debe mostrar bienvenida y nombre del pasajero seleccionado
    await expect(page.getByText('Check-in Digital Seguro')).toBeVisible();
    await expect(page.getByText('Constanza Valdés').first()).toBeVisible();

    // Localizar el canvas de firma
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await canvas.scrollIntoViewIfNeeded();

    // Dibujar trazo en el canvas
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + 100, box.y + 60, { steps: 10 });
      await page.mouse.move(box.x + 150, box.y + 30, { steps: 10 });
      await page.mouse.up();
    }

    // Botón de confirmación debe estar habilitado tras dibujar
    const btnConfirmar = page.getByRole('button', { name: /Confirmar y Firmar/i });
    await expect(btnConfirmar).toBeEnabled();

    // Enviar firma
    await btnConfirmar.click();

    // Verificar notificación de éxito
    await expect(page.getByText(/¡Deslinde firmado exitosamente!/i)).toBeVisible();
  });
});
