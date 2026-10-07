---
name: agente-autonomo
description: "Guía de ejecución y ciclo de vida autónomo para el agente en paraglide. Úsalo siempre al implementar código, resolver incidencias, refactorizar o verificar cambios sin intervención humana. Define el protocolo de gates obligatorios, seguridad de bases de datos y auto-verificación."
---

# Protocolo de Ejecución Autónoma — Paraglide

Cuando el usuario delega una tarea en modo 100% autónomo ("yo casi no toco el código"), el agente debe actuar como un ingeniero senior full-stack independiente, asegurando que nada se rompa y que todo código entregado esté estrictamente validado.

---

## 1. Reglas Inmutables de Operación (Seguridad Primero)

1. **Base de Datos Dev vs Prod**:
   - Dev DB corre en el **puerto 5679** (`docker compose -f docker-compose.dev-db.yml`).
   - **PROHIBIDO tocar el puerto 5678** (Producción). Cualquier mención a 5678 o DB `parapente_db` está bloqueada.
2. **Dinero y Finanzas**:
   - Usar siempre `toNum()` de `money.util.ts` (`Decimal(12,2)`). Nunca operadores aritméticos de JS (`+`, `-`, `>=`) sobre `Decimal`.
3. **Soft Delete**:
   - Toda consulta debe respetar `deletedAt: null`. No saltarse Prisma extensions con SQL crudo inseguro.
4. **Concurrencia**:
   - Operaciones sobre reservas deben chequear `version Int` y manejar conflictos con HTTP 409.

---

## 2. Ciclo de Vida de Ejecución Autónoma (Loop de 5 Pasos)

```
[1. Diagnóstico] ➔ [2. Implementación] ➔ [3. Single-Shot Gate] ➔ [4. Verificación UI/E2E] ➔ [5. Entrega]
```

### Paso 1: Diagnóstico y Pre-vuelo
- Ejecutar `git status` para ver el estado actual del árbol de trabajo.
- Si hay dudas sobre tipos o DTOs, consultar primero `packages/shared/src`.
- Si se requiere consultar datos reales de prueba, usar el MCP `postgres-dev` o `docker compose -f docker-compose.dev-db.yml exec ...`.

### Paso 2: Implementación
- Modificar o crear archivos de forma modular y limpia.
- Tras editar `packages/shared`, es mandatorio compilarlo:
  ```bash
  npm run build:shared
  ```
- Tras editar `apps/api/prisma/schema.prisma`, regenerar el cliente:
  ```bash
  cd apps/api && npx prisma generate
  ```
- Tras implementar (y antes de commitear), formatear de forma incremental:
  ```bash
  npm run format
  ```
  Prettier corre como CLI, no como extensión del editor (no hay `formatOnSave`). El formateo es responsabilidad explícita del agente. El alcance es incremental por diseño: `scripts/format.mjs` solo toca los archivos que Git ve cambiados (staged + modificados + untracked). **Prohibido** formatear el repo completo o agregar `format:check` a `check:quick`: el árbol tiene cientos de archivos legacy sin formatear y un check global rompería el gate obligatorio de forma permanente. Markdown (`.md`) queda fuera del scope por decisión propia: Prettier realinea las tablas y el resultado es ruido ilegible en la documentación que el agente lee. Para acotar alcance: `npm run format -- apps/web/src`; para otra base: `FORMAT_BASE=origin/main npm run format`.

### Paso 3: Single-Shot Verification Gate (Mandatorio antes de responder)
El agente **NO** debe dar por terminada una tarea sin ejecutar el gate rápido:
```bash
npm run check:quick
```
Este comando valida de forma atómica:
1. Build de `@parapente/shared`
2. `typecheck` estricto en todos los workspaces (shared, api, web, mcp)
3. Tests unitarios en `apps/api`, `apps/web` y `apps/mcp`

> **Límite de corrección autónoma:** Si `check:quick` falla con errores de TypeScript o tests rotos, el agente debe leer el error, corregir el código y volver a correr el gate (máximo 3 iteraciones autónomas) hasta que la salida sea código de salida 0.

### Paso 4: Verificación Visual y E2E (Si se modificó frontend en `apps/web`)
- Para páginas y componentes UI, verificar que el diseño cumpla:
  - Tokens canónicos de Tailwind v4 (`border-slate-200 dark:border-slate-700`, `bg-linear-to-*`).
  - Modo claro y oscuro coherente.
  - Ancho de viewport móvil (375px) sin desbordamientos horizontales.
  - Consola limpia de errores de React o promesas no resueltas.

### Paso 5: Reporte de Entrega
- Resumir de forma concisa y profesional qué se implementó, qué archivos se modificaron y el resultado de las pruebas de verificación.
