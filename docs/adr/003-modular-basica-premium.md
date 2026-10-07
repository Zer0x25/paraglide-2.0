# ADR 003: Arquitectura Modular Básica vs Premium

## Estado
Aceptado

## Fecha
- **Aceptado**: Fase 7 (Arquitectura Modular Básica vs Premium) — 2026.
- **Última revisión**: 2026-08-18 (unificación de numeración).

## Contexto
El sistema debe poder venderse en dos planes: **Básica** y **Premium**. La versión Básica (core) debe funcionar por completo sin los módulos adicionales, y la versión Premium puede incluir un subconjunto arbitrario de módulos según lo contratado por el cliente. Esto exige que la aplicación web pueda activar/desactivar funcionalidad en tiempo de build sin acoplar el core a los módulos.

## Decisión
- **Core fijo**: Inicio (Dashboard), Pilotos, Reservas, Calendario de Vuelos, Analíticas y Auditoría & Logs (esta última solo para rol ADMIN). Siempre presentes, sin dependencia de módulos.
- **Módulos premium opcionales**: Copiloto IA, Equipos & Mantenimiento, Manifiestos & Reportes, Pista & Meteorología, Pantalla Sala/TV y Plantillas & WhatsApp.
- **Registro centralizado**: Todos los módulos se definen en `apps/web/src/modules/registry.ts` con su ruta, etiqueta, ícono, sección (main/admin), badge y estado.
- **Activación en caliente (runtime), versionada en repo**: La fuente de verdad es `apps/api/modules.config.json` (array de IDs de módulos premium habilitados). La API carga ese archivo en memoria (`apps/api/src/services/modules.service.ts`), lo expone vía `GET /api/modules` y permite cambiarlo sin rebuild con `GET/PUT /api/admin/modules` (solo ADMIN). Cada cambio emite el evento SSE `modulos-cambios`; el cliente (`apps/web/src/modules/runtime.ts`, consumido en `AppShell.tsx`) actualiza el sidebar al instante, sin recargar. El `registry.ts` delega `isModuleEnabled` al runtime. **Ya NO se usa `NEXT_PUBLIC_ENABLE_MODULE_*` ni rebuild para activar módulos** (mecanismo original del ADR, reemplazado).
- **Sidebar dinámico**: `AppShell.tsx` renderiza el core siempre y filtra los módulos premium por `isModuleEnabled()` y rol del usuario (sección admin).
- **Guard de rutas**: Cada página premium se envuelve con el HOC `withModule(id, Component)`. Si el módulo está deshabilitado, se renderiza `ModuleNotAvailable` ("Módulo no disponible") en lugar de la vista.
- **Configuración de Bloques Horarios en Calendario**: La antigua ruta `/configuracion` se integró como modal (`ConfigBloquesModal`) dentro de `/calendario`, por ser una funcionalidad del core.

## Consecuencias
- El core funciona standalone sin dependencias de módulos.
- Para una versión Básica se deja el array de `modules.config.json` vacío (o sin premium); para Premium parcial se listan solo los módulos contratados. El cambio por defecto requiere editar el JSON y redeploy; un cambio inmediato se hace con el toggle en `/admin/modules` (admin) y se propaga por SSE.
- Los módulos no habilitados quedan fuera del sidebar y muestran una página amigable si se accede por URL.
- Nuevos módulos requieren: agregarlo al registry, envolver su página con `withModule`, y (si aplica) listarlo en `modules.config.json`.
- La comprobación es **runtime por cliente** (no build-time): el `isModuleEnabled` delega al estado del runtime, actualizado por `GET /api/modules` + SSE. Esto permite control por despliegue/clon sin rebuild; si en el futuro se requiere por plan/usuario, `isModuleEnabled` puede combinar runtime + rol.

## Relaciones
- **ADR 002** (Monorepo): los módulos premium residen en `apps/web` bajo este monorepo.
- **ADR 004** (Sincronización): el runtime de módulos se actualiza vía el mismo canal SSE (`modulos-cambios`).