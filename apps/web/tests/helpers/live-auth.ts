import { test as base, expect, type BrowserContext } from '@playwright/test';

type AdminState = Awaited<ReturnType<BrowserContext['storageState']>>;

// Una sesión real por worker evita revocaciones (ADR 013) y repetir logins
// hasta agotar el límite de autenticación durante una misma suite de staging.
export const test = base.extend<Record<never, never>, { adminState: AdminState }>({
  adminState: [
    async ({ browser }, provide) => {
      const context = await browser.newContext({
        baseURL: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
      });
      let state: AdminState;
      try {
        const page = await context.newPage();
        await page.goto('/login');
        await page.fill('input[name="email"]', process.env.ADMIN_EMAIL ?? 'admin@parapente.com');
        await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD ?? 'admin123');
        await page.click('button[type="submit"]');
        await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
        await expect(page.getByRole('heading', { name: 'Panel de Control' })).toBeVisible();
        state = await context.storageState();
      } finally {
        await context.close();
      }
      await provide(state);
    },
    { scope: 'worker' },
  ],
  storageState: async ({ adminState }, provide) => provide(adminState),
});

export { expect };
