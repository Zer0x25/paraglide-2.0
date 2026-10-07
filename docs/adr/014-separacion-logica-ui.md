# ADR 014: Separación de Lógica y UI (Headless Controllers y Componentes Presentacionales)

## Estado
**Aceptado** (2026-09-21).

## Fecha
- **Propuesta**: 2026-09-21.

## Contexto
A medida que la aplicación creció, se concentraron múltiples responsabilidades en componentes visuales y hooks individuales:
- Hooks controladores que sobrepasan las 600–700 líneas (e.g. `useReservasController`, `usePilotosController`), mezclando orquestación de datos de servidor (TanStack Query / Outbox), gestión de estado de múltiples diálogos modales, validación de formularios dinámicos con Zod/React Hook Form, llamadas a cálculo de tarifas y formateo de mensajes externos (WhatsApp).
- Componentes presentacionales (e.g. `ReservaCard`, `VueloModal`) que acumulan lógica de negocio derivada (cálculo de inmutabilidad, reglas de eliminación dependientes del estado de pago, sincronización de temporizadores de refresco y derivación de estados).
- Páginas completas (e.g. `admin/users/page.tsx`, `equipos/page.tsx`, `voucher/[id]/page.tsx`) con más de 500 líneas donde la consulta a la API, los estados locales de múltiples modales y el marcado JSX conviven en un único archivo.

Esta mezcla de responsabilidades incrementa la complejidad ciclomática, dificulta el testing unitario aislado sin renderizar árboles de componentes pesados y propicia el re-renderizado innecesario.

## Decisión

Adoptar formalmente una **arquitectura de separación de capas en Frontend**:

### 1. Patrón Headless Controller Hook + Componente Presentacional
- **Componentes de UI (Presentacionales)**:
  - Responsabilidad exclusiva: renderizar marcado HTML/JSX, aplicar estilos Tailwind CSS v4, animaciones, accesibilidad (ARIA) y emitir eventos del usuario (`onClick`, `onChange`, `onSubmit`).
  - No deben realizar queries de datos directas (`useQuery`, `typedApi`), ni mutaciones complejas, ni calcular reglas de negocio extensas dentro del cuerpo de la función JSX.
- **Hooks Controladores (Headless)**:
  - Responsabilidad: encapsular toda la lógica de obtención y mutación de datos (TanStack Query, Outbox), manejo de caché, revalidaciones SSE, estado local de modales y validación de formularios.

### 2. Regla de Sub-Hooks Atómicos (< 300 Líneas)
- Todo controlador que supere las 300 líneas debe modularizarse en sub-hooks especializados según su dominio:
  - `use*Data`: obtención, paginación, filtros de servidor y debounce.
  - `use*Modals`: gestión de visibilidad y entidad seleccionada para diálogos/modales.
  - `use*Form`: formularios, validaciones Zod, `useFieldArray` y llamadas a cálculo de tarifas.
  - `use*Events` / `use*External`: integraciones externas (e.g. mensajería WhatsApp, webhooks).
- El hook principal del módulo (ej. `useReservasController`) actúa como un orquestador delgado (< 150 líneas) que compone estos sub-hooks y provee una API unificada y tipada para la vista.

### 3. Extracción de Lógica de Dominio a Funciones Puras
- Las reglas de negocio derivadas (ej. estados de tarjeta, inmutabilidad contable, si un registro puede ser eliminado según su saldo o agendamiento) deben residir en funciones puras y aisladas en `utils/` o `domain/`.
- Permite cobertura de pruebas unitarias al 100% de las ramas condicionales sin montar componentes React ni simular DOM.

### 4. Simetría Arquitectónica en Backend (`apps/api`)
- Las rutas Fastify monolíticas que actualmente contienen consultas Prisma y lógica de negocio (e.g. `public.routes.ts`, `reportes.routes.ts`) deben migrar progresivamente a la convención estándar del proyecto:
  $$\text{Route} \longrightarrow \text{Controller} \longrightarrow \text{Service}$$

## Consecuencias

### Positivas
- **Alta testeabilidad**: Se pueden probar formularios, modales y lógica de negocio mediante tests unitarios rápidos de Vitest sin necesidad de simular el DOM del navegador.
- **Mantenibilidad y legibilidad**: Reducción drástica del tamaño de archivos (de 700+ líneas a módulos cohesivos de 100–250 líneas).
- **Prevención de re-renders**: El aislamiento de estados locales (como inputs o modales) evita re-renderizar listas enteras.
- **Cumplimiento de guardrails**: Alineación estricta con las directrices de `AGENTS.md`.

### Negativas / Mitigaciones
- Mayor número de archivos por módulo: se mitiga manteniendo una convención de carpetas predecible (`hooks/`, `components/`, `utils/`).

## Relaciones
- **ADR 005 (Rendimiento y Datos)**: TanStack Query permanece confinado a los hooks de datos.
- **ADR 009 (Offline-first y Conflictos)**: La lógica de detección de conflictos (409) y encolado outbox se mantiene en los controladores sin contaminar los componentes visuales.
- **ADR 010 (Cliente API Tipado)**: Los sub-hooks consumen `typedApi` directamente.
