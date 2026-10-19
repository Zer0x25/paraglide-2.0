import { test, expect } from './helpers/live-auth';

test.describe.serial('Módulos Premium y Pantalla TV en Staging (E2E Premium)', () => {
  test('1. Pantalla Sala / TV FIDS (/pantalla): control de acceso, modal de enlaces admin y activación', async ({
    page,
    browser,
  }) => {
    await page.goto('/pantalla');
    await page.waitForLoadState('domcontentloaded');

    // El administrador puede abrir el tablero; una sesión anónima sin token no.
    const anonymous = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const anonymousPage = await anonymous.newPage();
      await anonymousPage.goto('/pantalla');
      await expect(
        anonymousPage.getByRole('heading', { name: /Enlace no disponible/i }),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await anonymous.close();
    }

    // Como administrador autenticado, está visible el botón de enlaces de acceso
    const btnEnlaces = page.getByRole('button', { name: /Enlaces de acceso/i });
    await expect(btnEnlaces).toBeVisible({ timeout: 5000 });
    await btnEnlaces.click();

    // Abre el panel administrativo de enlaces de pantalla
    await expect(page.getByText(/Enlaces de Acceso al Tablero/i)).toBeVisible({ timeout: 5000 });

    // Guardar token TV en el navegador
    const btnGuardarTv = page.locator('button[title*="Guardar en este navegador"]');
    if (await btnGuardarTv.isVisible()) {
      await btnGuardarTv.click();
      await expect(page.getByText(/este navegador ya puede abrir el tablero/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('2. Control de Equipos & Mantenimiento (/equipos): catálogo y métricas', async ({
    page,
  }) => {
    await page.goto('/equipos');
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: /Control de Equipos & Mantenimiento/i }),
    ).toBeVisible({ timeout: 10000 });

    // Verificar botón de registrar equipo
    await expect(page.getByRole('button', { name: /Registrar Equipo/i })).toBeVisible();

    // Verificar buscador de equipos
    const searchInput = page.locator('input[placeholder*="Buscar por código"]');
    await expect(searchInput).toBeVisible();
  });

  test('3. Estación Meteorológica (/meteorologia): semáforo de pista y widgets', async ({
    page,
  }) => {
    await page.goto('/meteorologia');
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: /Estación Meteorológica & Estado de Pista/i }),
    ).toBeVisible({ timeout: 10000 });

    // Botón de refresco manual
    const btnRefrescar = page.getByRole('button', { name: /Actualizar Datos/i });
    await expect(btnRefrescar).toBeVisible();

    // Semáforo operacional de despegue
    await expect(
      page.getByText(/PISTA ABIERTA|PISTA EN PRECAUCIÓN|PISTA CERRADA/i).first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test('4. Auditoría & Logs (/auditoria): bitácora y filtros de trazabilidad', async ({ page }) => {
    await page.goto('/auditoria');
    await page.waitForLoadState('domcontentloaded');

    await expect(
      page.getByRole('heading', { name: /Auditoría & Bitácora de Actividades/i }),
    ).toBeVisible({ timeout: 10000 });

    // Verificar controles de filtro
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible();
  });

  test('5. Configuración del Sistema (/configuracion): navegación entre pestañas', async ({
    page,
  }) => {
    await page.goto('/configuracion');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { name: /Configuración del Sistema/i })).toBeVisible({
      timeout: 10000,
    });

    // Verificar pestañas de configuración
    const tabTarifas = page.getByRole('button', { name: 'Tarifas', exact: true });
    const tabEmpresa = page.getByRole('button', { name: 'Empresa', exact: true });
    const tabReglas = page.getByRole('button', { name: 'Reglas', exact: true });

    await expect(tabTarifas).toBeVisible();
    await expect(tabEmpresa).toBeVisible();

    // Cambiar a pestaña Empresa
    await tabEmpresa.click();
    await expect(
      page.getByText(/Datos de la Escuela|Información Comercial|Identidad/i).first(),
    ).toBeVisible({
      timeout: 5000,
    });

    // Cambiar a pestaña Reglas
    await tabReglas.click();
    await expect(page.getByText(/Reglas Operativas|Punto de Encuentro/i).first()).toBeVisible({
      timeout: 5000,
    });
  });
});
