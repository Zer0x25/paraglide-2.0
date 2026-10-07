import { test, expect } from '@playwright/test';

test.describe('Integridad de Contratos en Vivo (Sin Mocks) (E2E Live)', () => {
  test('debe autenticarse con credenciales reales y navegar por las rutas core sin mocks ni errores de consola', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignorar warnings inocuos de React Dev / favicon
        if (
          text.includes('Download the React DevTools') ||
          text.includes('favicon.ico') ||
          text.includes('React Router')
        ) {
          return;
        }
        consoleErrors.push(text);
      }
    });

    // 1. Ir a /login
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Iniciar Sesión/i })).toBeVisible();

    // 2. Ingresar credenciales reales de prueba del monorepo
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // 3. Esperar redirección al Dashboard principal
    // (rol heading: evita la ambigüedad con el route announcer de Next.js,
    // que replica el título de la página en un aria-live de accesibilidad)
    await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Panel de Control' })).toBeVisible({ timeout: 10000 });

    // 4. Navegar a /pilotos (contrato real con sobre ADR 005)
    await page.goto('/pilotos');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/Pilotos Registrados|Gestión de Pilotos/i)).toBeVisible({ timeout: 10000 });

    // 5. Navegar a /reservas
    await page.goto('/reservas');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/Gestión de Reservas|Listado de Reservas/i)).toBeVisible({ timeout: 10000 });

    // 6. Navegar a /calendario
    await page.goto('/calendario');
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.locator('.rbc-calendar, [data-testid="calendario"], button:has-text("Hoy")').first()
    ).toBeVisible({ timeout: 10000 });

    // 7. Verificar que la consola del navegador no registró errores críticos
    expect(consoleErrors).toHaveLength(0);
  });
});
