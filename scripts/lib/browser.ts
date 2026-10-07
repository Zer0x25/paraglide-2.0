/**
 * Módulo de automatización de navegador para suites E2E (Staging y Prod)
 * Monitorea errores de consola, administra sesiones y captura artefactos.
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import type { BrowserSession, SuiteConfig } from './types';

export async function launchBrowserSession(config: SuiteConfig): Promise<BrowserSession> {
  const browser: Browser = await chromium.launch({
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context: BrowserContext = await browser.newContext({
    baseURL: config.targetUrl,
    viewport: { width: 1280, height: 800 },
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
  });

  const page: Page = await context.newPage();

  const consoleErrors: string[] = [];
  const pageErrors: Error[] = [];

  const isDebug = process.env.DEBUG === '1' || !config.headless;

  page.on('console', (msg) => {
    const text = msg.text();
    // Ignorar warnings inocuos de React dev / librerías externas
    if (
      text.includes('Download the React DevTools') ||
      text.includes('favicon.ico') ||
      (text.includes('Failed to load resource: the server responded with a status of 404 (Not Found)') && text.includes('favicon'))
    ) {
      return;
    }
    if (msg.type() === 'error') {
      consoleErrors.push(text);
      if (isDebug) console.error(`   🛑 [BROWSER CONSOLE ERROR] ${text}`);
    } else if (isDebug) {
      console.log(`   ℹ️ [BROWSER CONSOLE ${msg.type().toUpperCase()}] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err);
    if (isDebug) console.error(`   💥 [BROWSER PAGE ERROR] ${err.message}`);
  });

  if (isDebug) {
    page.on('requestfailed', (req) => {
      console.warn(`   ⚠️ [BROWSER NET FAIL] ${req.method()} ${req.url()} (${req.failure()?.errorText})`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        console.warn(`   ⚠️ [BROWSER HTTP ${res.status()}] ${res.request().method()} ${res.url()}`);
      }
    });
  }

  const close = async () => {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  };

  return {
    browser,
    context,
    page,
    consoleErrors,
    pageErrors,
    close,
  };
}

export async function loginUi(session: BrowserSession, config: SuiteConfig): Promise<void> {
  const { page } = session;
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 });

  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');
  const submitBtn = page.locator('button[type="submit"]');

  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });

  await emailInput.fill(config.adminEmail);
  await passwordInput.fill(config.adminPassword);
  await submitBtn.click();

  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20000 });
}

export async function takeFailureScreenshot(page: Page, testName: string): Promise<string | null> {
  try {
    const dir = path.join(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const cleanName = testName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const filePath = path.join(dir, `failure_${Date.now()}_${cleanName}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    console.log(`📸 [SCREENSHOT] Captura guardada en: ${filePath}`);
    return filePath;
  } catch (err) {
    console.warn(`⚠️ No se pudo capturar screenshot:`, err);
    return null;
  }
}
