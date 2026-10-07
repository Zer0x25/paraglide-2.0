# ADR 012: Dispositivo Primario (modo offline read-only para no-primary)

## Estado
**Propuesto** (2026-08-27). No implementado.

## Fecha
- **Propuesta**: 2026-08-27.

## Contexto

La escuela tiene **un único admin por escuela**, un **Recepcionista** (reservas) y **pilotos** con acceso restringido. El sistema es offline-first (ADR 009): en caída de servicio cada dispositivo con credenciales válidas lee de su espejo local (IndexedDB) y encola mutaciones en su outbox, que se reenvían al reconectar.

Riesgo que el admin quiere evitar: durante una caída, dos dispositivos (tablet de recepción + notebook del admin) editan el **mismo** registro offline; al reconectar ambos replays chocan y generan conflictos `409` (ADR 004) que hoy van al store `conflictos` para resolución manual.

La solución pedida es **más simple que un fence en el server**: el admin marca un **dispositivo primario** (localmente). Durante una caída, los dispositivos **no primarios** pueden *leer* su caché pero **no pueden escribir**: al intentar cualquier mutación, la app lo bloquea en el cliente con un aviso. No se encola nada, no viaja al server, no hay conflictos post-caída que resolver.

El JWT ya es `7d` (`apps/api/src/services/auth.service.ts:40`), así que el admin opera offline durante horas sin caducar. Eso resuelve la *disponibilidad* del primary; este ADR resuelve la *exclusividad de escritura* en caída sin backend nuevo.

## Decisión

### 1. Flag "Dispositivo Primario" — local, no va al server
- Preferencia booleana `isPrimaryDevice` persistida en `localStorage` (o IDB) **por navegador**. No se envía al server niparticipa en auth.
- Solo el **admin** puede activarla (es un rol de configuración, no de recepcionista/piloto).

### 2. Onboarding en el primer login del admin
- En el **primer login exitoso del admin** (detectado por `localStorage` sin marca de "login inicial hecho"), se muestra un modal:
  > "¿Deseas hacer de este dispositivo el **Dispositivo Primario**?
  > En caso de caída del servidor, solo el dispositivo primario podrá registrar cambios (reservas, pagos, vuelos). Los demás dispositivos quedarán en modo solo lectura hasta que vuelva la conexión."
  > [Hacer primario] [Ahora no]
- Al aceptar: `isPrimaryDevice = true`. Al rechazar: `false` (pero el modal no vuelve a molestar salvo que se borren datos locales).

### 3. Login desde otro dispositivo
- Si un admin inicia sesión en un dispositivo donde `isPrimaryDevice === false` (o no definido) **y ya existe un primario conocido** (ver punto 4), se muestra un aviso no bloqueante:
  > "Este no es tu Dispositivo Primario. Durante caídas del servidor no podrás hacer cambios desde aquí. ¿Deseas cambiar el primario a este dispositivo?"
  > [Hacer primario] [Mantener actual]
- Esto cubre el caso "el admin perdió el dispositivo primario": desde cualquier otro dispositivo con sesión válida puede **re-asignar** el primario. Si el admin no lo hace, es **decisión consciente**, no olvido.

### 4. ¿Cómo sabe el cliente "ya existe un primario conocido"?
- El server **no** guarda el primario (es decisión de diseño: sin backend nuevo). En su lugar, el cliente recuerda localmente el `deviceId` que fue primario la última vez (persistido). El aviso del punto 3 se dispara si el `deviceId` actual ≠ el primario recordado.
- `deviceId` estable por navegador: se genera una vez (`crypto.randomUUID()`) y se persiste en `localStorage`/IDB. Hoy el `X-Client-Id` de `apps/web/src/services/api.ts` se regenera por request (línea 49); para este ADR solo se necesita un ID estable *local*, no necesariamente el header de idempotencia.

### 5. Bloqueo de escritura en caída (el núcleo)
- En `useDomainMutation` (o en `typedApiOutbox`): si `!online && !isPrimaryDevice` → se aborta la mutación **antes** de tocar la red/outbox, lanzando un error controlado que dispara un toast:
  > "Modo offline: este dispositivo no puede hacer cambios. Usa el Dispositivo Primario."
- El outbox **no** se usa en este caso (no hay nada que encolar: el dispositivo no tiene permiso para escribir en caída).
- Con red presente (`online === true`), **cualquier** dispositivo escribe normal (el primario solo importa durante la caída). Esto preserva que el recepcionista trabaje en su tablet con red.

### 6. UI de configuración
- Pestaña **Configuración → "Dispositivo Primario"**: toggle "Este es el dispositivo primario" + texto explicativo de la utilidad (espejo del modal de onboarding). Admin-only. Permite activar, desactivar o cambiar de dispositivo en cualquier momento.

## Alternativas consideradas

- **Fence en el server (`423 Locked`, lease por escuela)** — ADR 012 v1. Más robusto en teoría (el server es la fuente de verdad del fence) pero 10x más código: plugin gate, lease con TTL, `deviceId` estable en header, SSE de cambio de primario, botón "tomar posesión". El bloqueo cliente-only cubre el 100% del caso real (un admin, caída controlada, un escritor) sin backend. **Descartada en favor de la versión cliente.**
- **No-primary nunca escribe (ni online)** — rompe que el recepcionista opere con red. Descartada: el primario solo restringe en caída.
- **Lock por recurso (por registro)** — granular pero excesivo para una escuela. Descartada.

## Consecuencias

- **Positivas**: durante caídas, escrituras efectivas desde un solo dispositivo → **0 conflictos** post-reconexión por doble-escritura. Sin backend nuevo, sin lease, sin `deviceId` en el server.
- **Negativas / riesgos**:
  - El primario es **local por navegador**: si el admin borra datos locales (`localStorage`), pierde la marca y vuelve el modal de onboarding. Aceptable.
  - Si el admin pierde el dispositivo primario y **no** re-asigna desde otro, la escuela queda sin escritor en la próxima caída. Mitigado por el aviso en login de otros dispositivos (punto 3): no re-asignar es decisión consciente.
  - El bloqueo depende de `useOnlineStatus` (eventos `online`/`offline` del navegador). Si el navegador reporta online pero el server está caído (falso positivo), el dispositivo no-primary intentará escribir y el `ERR_NETWORK` lo encolará en el outbox (comportamiento ADR 009 normal). No es peor que hoy.

## Relaciones

- **ADR 009** (Offline-first): el outbox y `conflictos` siguen existiendo para el **dispositivo primario**; los no-primary simplemente no escriben en caída. El bloqueo cliente evita generar conflictos, no los resuelve (eso sigue siendo ADR 004/`409`).
- **ADR 004** (Concurrencia): el `version`/`409` sigue siendo el mecanismo de reconciliación cuando hay red.
- **ADR 007** (SSE): no se necesita difusión de primario (es local).
- `apps/web/src/hooks/useOnlineStatus.ts` — fuente de `online`. `apps/web/src/hooks/useDomainMutation.ts` — punto de inserción del bloqueo.

## Referencias

- `apps/web/src/services/api.ts:49` — hoy `X-Client-Id` por request; este ADR solo necesita un `deviceId` estable *local* (no el header).
- `apps/web/src/hooks/useOnlineStatus.ts` — estado de conectividad.
- `apps/web/src/hooks/useDomainMutation.ts` — primitiva de mutaciones donde se inserta el guard.
- `apps/api/src/services/auth.service.ts:40` — JWT `expiresIn: '7d'` (base de disponibilidad offline del admin).
