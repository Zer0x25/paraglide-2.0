import { test, expect, type Page } from '@playwright/test';

test.describe.serial('Experiencia y Responsive Móvil 375px (DoD Mobile Viewport)', () => {
  // Configuración estricta de viewport móvil (iPhone SE / estándar 375px)
  test.use({
    viewport: { width: 375, height: 667 },
  });

  async function assertNoHorizontalScroll(page: Page, contextName: string) {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // Se permite un margen de 1px por redondeos sub-pixel del renderizador
    expect(
      scrollWidth,
      `Desbordamiento horizontal detectado en ${contextName}: scrollWidth (${scrollWidth}px) > clientWidth (${clientWidth}px)`,
    ).toBeLessThanOrEqual(clientWidth + 1);
  }

  test('Flujo móvil completo en 375px: Dashboard -> Drawer -> Pilotos -> Reservas -> Calendario', async ({
    page,
  }) => {
    // 1. Autenticación administrativa real en Staging
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.fill('input[name="email"]', process.env.ADMIN_EMAIL ?? 'admin@parapente.com');
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD ?? 'admin123');
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
    await assertNoHorizontalScroll(page, 'Dashboard Móvil');

    // 2. Drawer y Menú Móvil
    const btnMenu = page.getByRole('button', { name: 'Abrir menú' });
    await expect(btnMenu).toBeVisible();

    await btnMenu.click();
    await expect(page.locator('aside')).toHaveClass(/translate-x-0/);

    const navPilotos = page.locator('aside').getByRole('link', { name: 'Pilotos', exact: true });
    await expect(navPilotos).toBeVisible({ timeout: 5000 });

    const btnCerrar = page.getByRole('button', { name: 'Cerrar menú' });
    await btnCerrar.click();
    await expect(page.locator('aside')).toHaveClass(/-translate-x-full/);
    await assertNoHorizontalScroll(page, 'Dashboard Móvil tras cerrar menú');

    // 3. Gestión de Pilotos Móvil
    await page.goto('/pilotos');
    await page.waitForLoadState('domcontentloaded');
    await assertNoHorizontalScroll(page, 'Pilotos Móvil');

    await page.getByRole('button', { name: /Nuevo Piloto/i }).click();
    await expect(page.getByRole('heading', { name: 'Agregar Nuevo Piloto' })).toBeVisible({
      timeout: 5000,
    });
    await assertNoHorizontalScroll(page, 'Modal Nuevo Piloto Móvil');

    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Agregar Nuevo Piloto' })).not.toBeVisible({
      timeout: 5000,
    });

    // 4. Gestión de Reservas Móvil
    await page.goto('/reservas');
    await page.waitForLoadState('domcontentloaded');
    await assertNoHorizontalScroll(page, 'Reservas Móvil');

    await page.getByRole('button', { name: /Nueva Reserva/i }).click();
    await expect(page.getByRole('heading', { name: 'Crear Nueva Reserva' })).toBeVisible({
      timeout: 5000,
    });
    await assertNoHorizontalScroll(page, 'Modal Nueva Reserva Móvil');

    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Crear Nueva Reserva' })).not.toBeVisible({
      timeout: 5000,
    });

    // 5. Calendario Móvil
    await page.goto('/calendario');
    await page.waitForLoadState('domcontentloaded');

    const btnAgenda = page.getByRole('button', { name: /Vista Agenda/i });
    if (await btnAgenda.isVisible()) {
      await btnAgenda.click();
      await expect(page.getByRole('button', { name: /Vista Mensual/i })).toBeVisible({
        timeout: 5000,
      });
    }
    await assertNoHorizontalScroll(page, 'Calendario Vista Agenda Móvil');
  });
});
