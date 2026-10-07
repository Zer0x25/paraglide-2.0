# ADR 002: Arquitectura Monorepo y Espacios de Trabajo

## Estado
Aceptado

## Fecha
- **Aceptado**: Fase 2 (Arquitectura Monorepo y Calidad Core) — 2026.
- **Última revisión**: 2026-08-18 (unificación de numeración).

## Contexto
Para el MVP se construirán sistemas separados de Frontend y Backend, pero que operan bajo los mismos recursos de dominio (Mismos Tipos, DTOs, Entidades). Si usamos repositorios separados, duplicaremos código y sufriremos desincronizaciones en la fase de desarrollo.

## Decisión
Utilizaremos un modelo **Monorepo gestionado por `npm workspaces`**.
Tendremos la siguiente estructura jerárquica de proyectos:
- `apps/web`: Frontend Next.js
- `apps/api`: Backend Node/Fastify + Prisma
- `packages/shared`: Tipos, utilidades y esquemas (Zod) consumidos por `api` y `web` como `dist/` construido con `npm run build:shared` (los apps no lo reconstruyen).
- `docs/adr`: Decisiones clave (este directorio; ver `README.md` índice).

## Consecuencias
- Un solo comando global instalará las dependencias de todos los paquetes.
- Permite lanzar tanto Next.js como Fastify localmente mediante un orquestador o scripts concurrentes a futuro.

## Alternativas consideradas
- **Repos separados por app**: descartado — duplica `packages/shared` y desincroniza tipos DTO en desarrollo.
- **Monorepo con pnpm/turbo/Nx**: `npm workspaces` es suficiente para este tamaño; migrar a turborepo si crece la necesidad de cache de builds.

## Relaciones
- **ADR 001** (Stack y Arquitectura): define el stack que este monorepo aloja.
- **ADR 003** (Modular Básica/Premium): los módulos premium viven dentro de `apps/web` bajo este monorepo.