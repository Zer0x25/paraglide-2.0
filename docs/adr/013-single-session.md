# ADR 013: Single-Session por Usuario (revocación de JWT vía sessionVersion)

## Estado
**Aceptado e implementado** (2026-08-27, verificado en `auth.service.ts`, `schema.prisma` y plugin `auth.ts`).

## Fecha
- **Propuesta**: 2026-08-27.

## Contexto

El sistema emite un JWT de acceso con `expiresIn: '7d'` (`apps/api/src/services/auth.service.ts:40`). No hay mecanismo de revocación: un usuario que inicia sesión en N dispositivos a lo largo de la semana acumula **N JWT válidos** que conviven hasta expirar. Para una escuela con un admin, un recepcionista y pilotos, eso significa múltiples dispositivos con credenciales vivas simultáneas.

Esto choca con la resiliencia offline (ADR 009) y con el ADR 012 (dispositivo primario): durante una caída de servicio, **cada dispositivo con JWT válido puede encolar escrituras** en su outbox y, al reconectar, disputar el mismo registro. El ADR 012 reduce eso a nivel de UI (el no-primary se bloquea en cliente), pero no limita cuántos JWT válidos existen *antes* de la caída.

Se pide: **al iniciar sesión en un dispositivo, caducar inmediatamente la sesión de cualquier dispositivo anterior**. Esto deja a lo sumo **una sesión viva por usuario** y, como corolario, reduce la superficie offline a un solo escritor potencial por usuario durante caídas.

La regla aplica a **todos los usuarios** (admin, recepcionista, pilotos), no solo al admin.

## Decisión

### 1. Campo `sessionVersion` en `User`
- Añadir `sessionVersion Int @default(0)` al modelo `User` de `apps/api/prisma/schema.prisma`.
- Migración: `prisma db push` (o migración generada). Columna nueva con default 0 → no rompe datos existentes.

### 2. Emitir `sv` en el JWT (login)
- En `auth.service.ts`, antes de firmar: incrementar `user.sessionVersion` y embutir ese valor en el payload del JWT como claim `sv`.
- Ejemplo de payload firmado: `{ sub, role, sv }`.

### 3. Validar `sv` en el plugin de auth (onRequest)
- En `apps/api/src/plugins/auth.ts`, tras `jwtVerify()`:
  1. Leer el usuario por `sub`.
  2. Comparar `decoded.sv === user.sessionVersion`.
  3. Si no coinciden → `reply.code(401).send({ message: 'Sesión cerrada en otro dispositivo' })`.
- **Optimización** (opcional, no bloqueante): cachear `userId → sessionVersion` en memoria (TTL corto) para no leer DB en cada request; invalidar al hacer login.

### 4. Logout explícito
- El logout mantiene el comportamiento actual (borra cookie en cliente). **No** decrementa `sessionVersion`: un logout no debe matar otras sesiones (solo el nuevo login lo hace). Esto es intencional: si el admin cierra sesión en su tablet y luego entra en el laptop, la tablet ya estaba muerta por el login del laptop; el logout de la tablet es cosmético.

### 5. UX de sesión desplazada
- El cliente (`api.ts` interceptor, ya maneja `401` redirigiendo a `/login`) mostrará un toast específico cuando el `401` traiga `code: 'SESSION_REVOKED'`: *"Tu sesión se cerró porque iniciaste sesión en otro dispositivo."*

## Alternativas consideradas

- **Lista negra de JWT (denylist en Redis/cache)**: permite revocar selectivamente sin matar todas las sesiones, pero exige infraestructura de cache y lookup por token en cada request. Excesivo para "1 sesión viva". Descartada.
- **Refresh token + access token corto (p.ej. 15min)**: estándar en SPAs, pero el access corto rompe la disponibilidad offline del admin (el ADR 012 asume JWT de 7d para operar horas sin red). Incompatible con el requisito de offline del admin. Descartada.
- **Tabla de sesiones explícita (Session model)**: da auditabilidad (IP, device) pero es mucho más que lo pedido. El entero `sessionVersion` cubre el caso "una sesión a la vez" con 1 columna. Descartada por sobre-ingeniería.
- **No hacer nada (JWT 7d sin revocación)**: deja múltiples dispositivos con escritura potencial en caída. Es el estado actual y el que se quiere mejorar. Descartada.

## Consecuencias

- **Positivas**:
  - A lo sumo **1 sesión viva por usuario** en cualquier momento → superficie offline mínima (1 escritor potencial por usuario en caída).
  - Sin infraestructura nueva (ni Redis ni tabla de sesiones): solo 1 columna + 1 comparación.
  - Refuerza el ADR 012: el primario sigue siendo señal de UI, pero la frontera de seguridad real es "solo hay 1 JWT vivo".
  - Cubre "admin pierde el dispositivo primario": entrar desde otro mata la sesión del perdido automáticamente.
- **Negativas / riesgos**:
  - **Cierra sesión en dispositivos abiertos**: si el admin tiene tablet y laptop abiertos y entra en el laptop, la tablet muere. Para 1-admin-por-escuela es deseable, no un bug; pero el equipo de operación debe saberlo.
  - **Requiere red para actuar**: la revocación solo ocurre en el momento del nuevo login (que necesita server). No ayuda *durante* una caída ya iniciada — ahí manda el ADR 012 (bloqueo cliente). Son capas complementarias.
  - **Lectura a DB por request** (o cache): pequeño overhead; mitigable con cache de `sessionVersion`.
  - **Pilotos/recepcionista también quedan single-session**: si un piloto entra en su celular y ya estaba en la tablet de la escuela, la tablet muere. Aceptable y consistente con "todos los usuarios".

## Relaciones

- **ADR 009** (Offline-first): single-session reduce cuántos dispositivos acumulan JWT válidos antes de una caída, limitando los escritores potenciales del outbox.
- **ADR 012** (Dispositivo primario): single-session es la frontera de seguridad en el server (1 sesión viva); el primario es la señal de UI en el cliente (el no-primary no escribe en caída). Se complementan: durante caída hay a lo sumo 1 JWT vivo y, si ese no es primario, ni escribe.
- `apps/api/src/services/auth.service.ts:40` — emisión del JWT (aquí se incrementa `sessionVersion` y se firma `sv`).
- `apps/api/src/plugins/auth.ts` — validación del JWT (aquí se compara `sv`).
- `apps/web/src/services/api.ts` — interceptor `401` (aquí se muestra el toast de sesión revocada).

## Referencias

- `apps/api/prisma/schema.prisma` — modelo `User` (añadir `sessionVersion`).
- `apps/api/src/services/auth.service.ts:40` — `expiresIn: '7d'`.
- Patrón: *single-session / session versioning* (revocación sin denylist).
