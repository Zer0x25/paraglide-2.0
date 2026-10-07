# ADR 001: Stack Tecnológico y Resumen de Arquitectura

## Estado
Aceptado

## Fecha
- **Aceptado**: Fase 1 (MVP) — 2026-04-30 (primer commit del repo).
- **Última revisión**: 2026-08-18 (fusión de los antiguos ADR 001 "Stack" y "Resumen de Arquitectura" + corrección de versiones).

## Contexto
Construimos una aplicación de reservas de vuelos biplaza en parapente para una escuela. Debe gestionar pilotos, pasajeros y reservas de vuelos, validando y previniendo choques de horarios de pilotos. El sistema evolucionó del MVP inicial (un solo perfil Admin, sin pagos online) a un producto con roles (ADMIN/operador), pagos (`Pago`/`EstadoPago`/`MetodoPago`), módulos premium y operación multi-dispositivo concurrente.

Se adopta una arquitectura de **Monorepo** para separar responsabilidades y escalar frontend/backend de forma independiente (ver ADR 002).

## Decisión

### Stack tecnológico (versiones vigentes)
- **Frontend**: Next.js 16 (App Router) con React 19, PWA vía `@ducanh2912/next-pwa`. Por su rendimiento modular y experiencia de desarrollo.
- **Backend**: Node.js con Fastify 5. API REST eficiente con validación por esquemas JSON integrados.
- **Base de Datos**: PostgreSQL 18.4 (imagen `postgres:18.4-alpine`). Motor relacional que garantiza las relaciones (vuelos -> pilotos/pasajeros).
- **ORM**: Prisma 6. Esquematiza la BD y provee tipado en la comunicación TypeScript.
- **Lenguaje Global**: TypeScript en todo el monorepo.
- **Fetching (web)**: TanStack Query 5 (reemplaza a SWR desde el Pilar 5 del ADR 005).

### Modelo de Datos Principal (Prisma)
- **Piloto**: instructor/piloto. Atributos críticos: peso, licencia, prioridad de asignación, disponibilidad y `version` para concurrencia optimista (ADR 004).
- **Pasajero**: cliente del vuelo. Atributos críticos: peso, contacto de emergencia, condición física, firma de deslinde.
- **Vuelo**: entidad central que une Piloto y Pasajero en una Fecha/Hora, con valor pactado y estado (`AGENDADO`, `COMPLETADO`, `CANCELADO`).
- **Reserva**: reservas grupales; múltiples Pasajeros por Reserva; gestiona pagos parciales/totales (`Pago`, `EstadoPago`, `MetodoPago`).
- **ConfiguracionBloque & HorarioBloque**: modelado de bloques de horarios de la escuela.
- **ExcepcionFecha / PilotoDisponibilidadBloque**: fechas/bloques en los que un piloto no está disponible.

### Convenciones del Proyecto
1. **Tipos Compartidos**: en `packages/shared` (DTOs/Zod), consumidos por `api` y `web` como `dist/` construido vía `npm run build:shared`. No duplicar tipos en los apps.
2. **RESTful API**: el backend expone rutas estandarizadas bajo `/api/*` (`/api/vuelos`, `/api/pilotos`, etc.).
3. **Manejo de Errores**: UI con manejo robusto de estado (sin `alert()` del navegador); errores de API traducidos a estados de UI.
4. **Soft delete**: los modelos con `deletedAt` (Gasto, ConfiguracionBloque, HorarioBloque…) se filtran automáticamente vía extensión de Prisma (ADR 006).

## Alternativas consideradas
- **Un solo repo monolítico**: descartado — acopla frontend y backend y dificulta despliegues independientes.
- **Repos separados**: descartado — duplica código y desincroniza tipos en desarrollo (de ahí el Monorepo, ADR 002).
- **Otro ORM (TypeORM/Drizzle)**: Prisma elegido por experiencia de tipado y migraciones; Drizzle queda como alternativa si se requiere SQL más cercano.
- **GraphQL**: sobre-ingeniería para este dominio; REST con filtros cubre el 100% (ADR 005).

## Consecuencias
- La arquitectura permite iterar rápido en la web de Next.js sin alterar las reglas de negocio tipadas en el backend con Prisma.
- `packages/shared` elimina la duplicación de DTOs; requiere reconstruir `dist/` (`build:shared`) al cambiar tipos.
- El versionado de entidades y el soft delete son transversales y se detallan en ADR 004 y ADR 006.

## Relaciones
- **ADR 002** (Monorepo): estructura física que habilita este stack.
- **ADR 004** (Sincronización): `version` en Piloto/Reserva/Vuelo/Pago.
- **ADR 005** (Rendimiento): contrato de listados y fetching con TanStack Query.
- **ADR 006** (Soft delete y enums): extensión Prisma que filtra `deletedAt` automáticamente.
