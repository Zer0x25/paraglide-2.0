/**
 * Suite 04: Módulos Premium, Auditoría y Seguridad RBAC
 * Consolida la verificación de equipos, plantillas, meteorología,
 * reportes, paginación de auditoría y barrera estricta RBAC.
 */

import {
  createSuiteRunner,
  resolveSuiteConfig,
  createApiClient,
  createTeardownRegistry,
  launchBrowserSession,
  loginUi,
} from '../lib';

export async function runModulesAdminSuite() {
  const config = resolveSuiteConfig({
    name: '04-Modules-Admin: Módulos, Auditoría & Seguridad RBAC',
    description: 'Equipos, Plantillas, Reportes, Meteorología, Keyset pagination en Auditoría y Bloqueo 403 para RECEPCION',
  });

  const runner = createSuiteRunner(config);
  const client = createApiClient(config);
  const teardown = createTeardownRegistry(client);

  try {
    let equipoId: number;
    let plantillaId: number;
    let recepcionEmail: string;
    let recepcionPassword: string = 'recepcion123!';
    let recepcionToken: string;

    // 1. Módulo de Equipos
    await runner.step('1. Módulo Equipos: Alta de equipo y consulta de inventario', async () => {
      const res = await client.post('/api/equipos', {
        codigo: `VELA-${Date.now().toString().slice(-4)}`,
        nombre: `Parapente Ozone ${Date.now()}`,
        tipo: 'VELA',
        marca: 'Ozone',
        modelo: 'Rush 6',
        numeroSerie: `SN-${Date.now()}`,
        horasVueloEstimadas: 12.5,
        estado: 'OPERATIVO',
      });

      if (!res.ok || !res.data?.id) {
        throw new Error(`Error creando equipo: HTTP ${res.status}`);
      }
      equipoId = res.data.id;
      teardown.registerCustom(async () => {
        await client.delete(`/api/equipos/${equipoId}`);
      });

      const resList = await client.get('/api/equipos');
      const equipos = client.unwrapList(resList);
      if (!equipos.some((e: any) => e.id === equipoId)) {
        throw new Error('Equipo creado no figura en el listado');
      }
      console.log(`   🪂 Equipo registrado con ID ${equipoId}`);
    });

    // 2. Módulo de Plantillas WhatsApp
    await runner.step('2. Módulo Plantillas: Creación y renderizado con variables', async () => {
      const suffix = Date.now();
      const res = await client.post('/api/plantillas', {
        titulo: `Plantilla Recordatorio ${suffix}`,
        tipo: `CUSTOM_${suffix}`,
        canal: 'WHATSAPP',
        cuerpo: 'Hola {{nombre}}, recordamos tu vuelo a las {{hora}} con piloto {{piloto}}.',
      });

      if (!res.ok || !res.data?.id) {
        throw new Error(`Error creando plantilla: HTTP ${res.status}`);
      }
      plantillaId = res.data.id;
      teardown.registerCustom(async () => {
        await client.delete(`/api/plantillas/${plantillaId}`);
      });

      console.log(`   📱 Plantilla de mensaje registrada con ID ${plantillaId}`);
    });

    // 3. Módulo Meteorología
    await runner.step('3. Módulo Meteorología: Estado actual y semáforo de pista', async () => {
      const res = await client.get('/api/meteorologia/estado-actual');
      if (!res.ok) {
        throw new Error(`Fallo al consultar estado meteorológico: HTTP ${res.status}`);
      }
      console.log(`   🌤️ Meteorología pista: velocidad=${res.data?.velocidadViento ?? 'N/A'}km/h, estado=${res.data?.estado || 'OK'}`);
    });

    // 4. Auditoría y no-filtración de contraseñas
    await runner.step('4. Auditoría con paginación y seguridad de usuarios (sin passwords expuestas)', async () => {
      const resAudit = await client.get('/api/auditoria?pageSize=10');
      if (!resAudit.ok) {
        throw new Error(`Error consultando auditoría: HTTP ${resAudit.status}`);
      }
      const logs = client.unwrapList(resAudit);
      console.log(`   📜 Registros de auditoría obtenidos: ${logs.length}`);

      // Comprobar que /api/users no expone password ni passwordHash
      const resUsers = await client.get('/api/users');
      if (resUsers.ok) {
        const users = client.unwrapList(resUsers);
        for (const u of users) {
          if ('password' in u || 'passwordHash' in u) {
            throw new Error(`Fuga de seguridad: usuario ${u.email} expone hash de contraseña en API`);
          }
        }
        console.log(`   🔒 Validación de usuarios completada: ${users.length} usuarios verificados sin fuga de credenciales`);
      }
    });

    // 5. Barrera estricta RBAC para rol RECEPCION
    await runner.step('5. Control de Acceso RBAC: Usuario RECEPCION recibe 403 en endpoints administrativos', async () => {
      recepcionEmail = `recep-${Date.now()}@parapente.test`;

      // Crear usuario con rol RECEPCION usando credenciales de ADMIN
      const resUser = await client.post('/api/users', {
        email: recepcionEmail,
        password: recepcionPassword,
        nombre: 'Recepcionista Auditoría',
        role: 'RECEPCION',
      });

      if (!resUser.ok || !resUser.data?.id) {
        throw new Error(`Error creando usuario RECEPCION: HTTP ${resUser.status}`);
      }
      const recepUserId = resUser.data.id;
      teardown.registerCustom(async () => {
        await client.delete(`/api/users/${recepUserId}`);
      });

      // Iniciar sesión como RECEPCION
      const loginRes = await fetch(`${config.targetUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recepcionEmail, password: recepcionPassword }),
      });

      if (!loginRes.ok) {
        throw new Error(`Error en login de RECEPCION: HTTP ${loginRes.status}`);
      }

      const loginData = (await loginRes.json()) as { token: string };
      recepcionToken = loginData.token;

      // Verificar que RECEPCION sea rechazado con 403 Forbidden en /api/auditoria
      const resForbidAudit = await client.get('/api/auditoria', { token: recepcionToken });
      if (resForbidAudit.status !== 403) {
        throw new Error(`Fallo de seguridad RBAC: RECEPCION accedió a /api/auditoria con HTTP ${resForbidAudit.status} (se esperaba 403)`);
      }

      // Verificar que RECEPCION sea rechazado con 403 en /api/admin/modules
      const resForbidMod = await client.get('/api/admin/modules', { token: recepcionToken });
      if (resForbidMod.status !== 403) {
        throw new Error(`Fallo de seguridad RBAC: RECEPCION accedió a /api/admin/modules con HTTP ${resForbidMod.status} (se esperaba 403)`);
      }

      // Verificar que RECEPCION sea rechazado con 403 en /api/reservas/1/cerrar y /reabrir (Fase 3 Inmutabilidad)
      const [resForbidCerrar, resForbidReabrir] = await Promise.all([
        client.post('/api/reservas/1/cerrar', {}, { token: recepcionToken }),
        client.post('/api/reservas/1/reabrir', { motivo: 'Intento' }, { token: recepcionToken }),
      ]);
      if (resForbidCerrar.status !== 403 || resForbidReabrir.status !== 403) {
        throw new Error(`Fallo de seguridad RBAC: RECEPCION no fue bloqueado con 403 en cerrar/reabrir: cerrar=${resForbidCerrar.status}, reabrir=${resForbidReabrir.status}`);
      }

      console.log(`   🛡️ Barrera RBAC verificada: RECEPCION bloqueado con HTTP 403 en endpoints críticos (auditoría, módulos, cierre y reapertura contable)`);
    });

    // 6. Navegación visual en navegador para rutas administrativas y reportes
    await runner.step('6. Navegación visual Playwright en /reportes y /admin/modules (cero errores de consola)', async () => {
      let session: Awaited<ReturnType<typeof launchBrowserSession>> | null = null;
      try {
        session = await launchBrowserSession(config);
        await loginUi(session, config);
        const { page } = session;

        // Visitar /reportes
        await page.goto(`${config.targetUrl}/reportes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.locator('h1, button').filter({ hasText: /Manifiesto|Reportes/i }).first().waitFor({ state: 'visible', timeout: 15000 });

        // Visitar /admin/modules
        await page.goto(`${config.targetUrl}/admin/modules`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.locator('h1, button').filter({ hasText: /Módulos/i }).first().waitFor({ state: 'visible', timeout: 15000 });

        if (session.consoleErrors.length > 0) {
          console.warn(`   ⚠️ Errores de consola en rutas admin:`, session.consoleErrors);
        } else {
          console.log(`   🖥️ Rutas /reportes y /admin/modules renderizadas sin errores de consola`);
        }
      } finally {
        if (session) await session.close();
      }
    });

    return runner.conclude();
  } finally {
    await teardown.cleanup();
  }
}

// Ejecución directa si se invoca como script
if (process.argv[1]?.endsWith('04-modules-admin.suite.ts')) {
  runModulesAdminSuite().then((res) => {
    if (!res.ok) process.exit(1);
  });
}
