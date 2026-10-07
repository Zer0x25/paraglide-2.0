import { test, expect } from '@playwright/test';
import { mockAppShellApi } from './helpers/api-mocks';

test.describe('Login Flow', () => {
  test('should display login page and perform login', async ({ page }) => {
    // Blindar el AppShell/warmup: sin esto, peticiones no mockeadas se fugan
    // al backend real y un 401 con el JWT fake redirige a /login (flakiness).
    await mockAppShellApi(page);

    // Ir a la página principal que redireccionará al login si no hay sesión
    await page.goto('/');

    // Verificar que estamos en la página de login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();

    // Completar el formulario
    // En un test real, se deben usar credenciales de prueba, ej: admin@parapente.com / admin123
    await page.fill('input[name="email"]', 'admin@parapente.com');
    await page.fill('input[name="password"]', 'admin123');

    // Dado que el backend podría no estar corriendo en el entorno de pruebas de CI de forma mock,
    // interceptamos la llamada para simular un inicio de sesión exitoso.
    await page.route('**/api/auth/login', async route => {
      const json = {
        token: 'fake-jwt-token',
        user: { id: 1, email: 'admin@parapente.com', role: 'ADMIN', nombre: 'Admin' }
      };
      await route.fulfill({ json });
    });

    await page.click('button[type="submit"]');

    // Verificar redirección al panel (rol heading: evita la ambigüedad con el
    // route announcer de Next.js, que replica el título de la página)
    await page.waitForURL(url => url.pathname === '/');
    await expect(page.getByRole('heading', { name: 'Panel de Control' })).toBeVisible();
  });
});
