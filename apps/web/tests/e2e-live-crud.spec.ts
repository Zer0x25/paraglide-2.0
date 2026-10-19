import { test, expect } from '@playwright/test';

test.describe.serial('Flujos CRUD en Vivo contra Staging (E2E Live CRUD)', () => {
  const uniqueSuffix = Date.now().toString().slice(-6);
  const pilotoNombre = `Piloto Live E2E ${uniqueSuffix}`;
  const titularNombre = `Titular Live E2E ${uniqueSuffix}`;

  test('Ciclo CRUD completo en vivo: Login -> Piloto -> Reserva -> Calendario', async ({
    page,
  }) => {
    // 1. Autenticación administrativa real en Staging
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.fill('input[name="email"]', process.env.ADMIN_EMAIL ?? 'admin@parapente.com');
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD ?? 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Panel de Control' })).toBeVisible({
      timeout: 10000,
    });

    // 2. Gestión de Pilotos: Crear y verificar persistencia
    await page.goto('/pilotos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: 'Gestión de Pilotos' })).toBeVisible({
      timeout: 10000,
    });

    await page.getByRole('button', { name: /Nuevo Piloto/i }).click();
    await expect(page.getByRole('heading', { name: 'Agregar Nuevo Piloto' })).toBeVisible({
      timeout: 5000,
    });

    await page.locator('input[required]').fill(pilotoNombre);
    await page.fill('input[placeholder="Ej: 12.345.678-9"]', `E2E-${Date.now()}`);
    await page.fill('input[type="email"]', `piloto.${uniqueSuffix}@parapente.com`);
    await page.fill('input[type="tel"]', '+56911223344');

    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: 'Agregar Nuevo Piloto' })).not.toBeVisible({
      timeout: 10000,
    });

    // Buscar el piloto recién creado y verificar en la tabla de escritorio
    const searchInput = page.locator('#pilotos-search-input');
    await searchInput.fill(pilotoNombre);
    await expect(page.locator('tbody').getByText(pilotoNombre)).toBeVisible({ timeout: 10000 });

    // 3. Gestión de Reservas: Crear y verificar persistencia
    await page.goto('/reservas');
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.getByRole('heading', { name: /Gestión de Reservas y Pasajeros/i }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Nueva Reserva/i }).click();
    await expect(page.getByRole('heading', { name: 'Crear Nueva Reserva' })).toBeVisible({
      timeout: 5000,
    });

    await page.fill('input[name="nombreTitular"]', titularNombre);
    await page.fill('input[name="telefono"]', '+56998877665');
    await page.fill('input[name="email"]', `titular.${uniqueSuffix}@parapente.com`);

    // Copiar datos del titular al primer pasajero
    const btnCopiar = page.getByRole('button', { name: /Copiar datos del titular/i });
    if (await btnCopiar.isVisible()) {
      await btnCopiar.click();
    } else {
      await page.fill('input[placeholder="Nombre y Apellido"]', titularNombre);
    }

    await page.fill('input[name="valorTotal"]', '60000');

    const btnCrear = page.getByRole('button', { name: /Crear Reserva/i });
    await expect(btnCrear).toBeEnabled({ timeout: 5000 });
    await btnCrear.click();

    await expect(page.getByRole('heading', { name: 'Crear Nueva Reserva' })).not.toBeVisible({
      timeout: 10000,
    });

    // Si abre el modal de pagos, cerrarlo
    const modalPagos = page.getByRole('heading', { name: /Historial de Pagos y Abonos/i });
    if (await modalPagos.isVisible({ timeout: 4000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await expect(modalPagos).not.toBeVisible({ timeout: 5000 });
    }

    // Filtrar y verificar que la reserva del titular aparezca en las tarjetas de reservas
    const searchReserva = page.locator('input[placeholder*="Buscar por titular"]');
    await searchReserva.fill(titularNombre);
    await expect(page.locator('h3', { hasText: titularNombre })).toBeVisible({ timeout: 10000 });

    // 4. Calendario: Carga y alternancia de vistas
    await page.goto('/calendario');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.rbc-calendar')).toBeVisible({ timeout: 10000 });

    // Alternar a Vista Agendas
    const btnAgenda = page.getByRole('button', { name: /Vista Agenda/i });
    if (await btnAgenda.isVisible()) {
      await btnAgenda.click();
      await expect(page.getByRole('button', { name: /Vista Mensual/i })).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
