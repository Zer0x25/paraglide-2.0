# Auditoría 1 — Base de Datos: Concurrencia Multicliente y Mejoras de Esquema

> **Estado:** ✅ **Completada e Implementada al 100%** (2026-08-18)  
> **Fecha original:** 2026-08-17  
> **Ámbito:** `apps/api/prisma/schema.prisma` (PostgreSQL)  
> **Motivación:** Auditoría post-ADR 004 para identificar tablas concurrentes y oportunidades de integridad en la base de datos (Dinero `Decimal`, enums nativos PG, pesos `Int`, soft-delete con `deletedAt`).

---

## 1. Tablas que necesitan manejo de concurrencia optimista

Criterio: datos **editados concurrentemente desde varios dispositivos** (operador de recepción, admin, pantalla de sala, móvil) y donde un guardado ciego pueda pisar el trabajo de otro.

| Modelo | ¿Concurrencia? | Prioridad | Por qué / acciones |
|---|---|---|---|
| **Piloto** | ✅ Ya implementado | — | `version Int` + `PUT /pilotos/:id/disponibilidad` atómico + SSE (ADR 004). |
| **Reserva** | **Sí** | 🔴 Alta | Múltiples operadores crean/editan reservas, cambian `estadoPago` y `abono`, agregan pasajeros. Añadir `version`, endpoint atómico por reserva (nunca parches ciegos). |
| **Vuelo** | **Sí** | 🔴 Alta | Asignación automática + manual simultánea, transiciones de `estado`. Añadir `version`; la asignación debe validar disponibilidad del bloque y no pisar a otro operador. |
| **Pago** | **Sí** | 🔴 Alta | Se registran pagos/abonos contra una reserva desde varios puntos; `monto`/`abono` acumulativos propensos a doble registro. Añadir `version` (y sumar dentro de la misma transacción que actualiza `reserva.abono`). |
| **CondicionPista** | Sí | 🟠 Media | La pista/meteorología se actualiza en vivo; varias personas pueden reportar el mismo día. Añadir `version` o bloquear a 1 editor por día. |
| **Gasto** | Sí | 🟠 Media | Administración financiera; pocos editores pero posible. Añadir `version`. |
| **ConfiguracionBloque** | Sí | 🟠 Media | Solo admin, pero es un punto único que afecta a todo el calendario. Añadir `version`. |
| **Equipo / MantenimientoEquipo** | Sí | 🟡 Baja | Admin; baja probabilidad de colisión, pero factible con 2 admins. Añadir `version` cuando se refactoricen. |
| **User** | No | — | Se edita casi nunca (crear admins/pilotos). No requiere ahora. |
| **PlantillaMensaje** | No | — | Config estática de admin. No requiere. |
| **ExcepcionFecha** | Cubierta | — | Hijo de Piloto; el `version` del piloto cubre su conjunto. |
| **PilotoDisponibilidadBloque** | Cubierta | — | Ídem. |
| **HorarioBloque** | Cubierta | — | Hijo de ConfiguracionBloque; cubierto si éste lleva `version`. |
| **LogAuditoria** | No | — | Append-only (nunca se edita). No requiere. |
| **PantallaToken** | No | — | Generado por servidor, expira. No requiere. |

**Total con manejo necesario (fuera de Piloto ya hecho): 8 modelos** — alta prioridad: `Reserva`, `Vuelo`, `Pago`; media: `CondicionPista`, `Gasto`, `ConfiguracionBloque`; baja: `Equipo`, `MantenimientoEquipo`.

> Regla de oro para el futuro: **toda mutación multi-cliente debe ir por un endpoint atómico y absoluto** (set, no toggle) dentro de una transacción, con `version` comparada → `409 Conflict`. Aplicar esto de entrada al Calendario y las Reservas (ADR 004).

---

## 2. Oportunidades de mejora de la base de datos

### 2.1 Money en `Float` → `Decimal`/entero
`valorTotal`, `abono`, `monto` (Pago/Gasto), `tarifaPorVuelo`, `pagoPiloto`, `valorPactado`, `costo` son `Float`. Los floats tienen errores de redondeo en JS/Postgres; para dinero se debe usar `Decimal` (o entero en centavos). **Riesgo alto en financiero.**
→ Migrar a `Decimal(12,2)` o `Int` en centavos + tipo Zod correspondiente.

### 2.2 Enums como `String` sin constraint
`estadoPago`, `estadoVuelo`, `tipo` (equipo), `estado` (equipo), `estadoPista`, `canal`, `categoria` del piloto, `metodoPago`, `accion/entidad` de auditoría se guardan como `String` → Postgres no valida valores. El paquete `@parapente/shared` ya define los enums en Zod, pero la DB no los exige.
→ Crear enums nativos de Postgres (o `CHECK`) y alinearlos con los Zod.

### 2.3 Pesos y rangos `Float` con validación solo en Zod
`peso`, `pesoMinimoPasajero`, `pesoMaximoPasajero`, `pesoVerificado` son `Float`; ya validamos enteros en la capa Zod y el simulador, pero la DB aceptaría decimales.
→ Cambiar a `Int` (kg enteros) para que la constraint sea física.

### 2.4 `deletedAt` inconsistente (soft delete incompleto)
Tablas con `deletedAt`: User, Piloto, Reserva, Pasajero, Vuelo, Pago, Equipo, MantenimientoEquipo, CondicionPista, PlantillaMensaje.
Tablas **sin** `deletedAt` (se borran físicamente, perdiendo historia):
- `Gasto` (se borra con `delete` en la API).
- `ConfiguracionBloque` y `HorarioBloque` (la API hace `delete`/`deleteMany` físicos).
- `LogAuditoria`, `PantallaToken`, `ExcepcionFecha`, `PilotoDisponibilidadBloque` (ok por ser append-only/temporales).
→ Estandarizar soft delete en `Gasto` y `ConfiguracionBloque` (y heredar a `HorarioBloque`), o documentar por qué se permite borrado físico.

### 2.5 Falta de `updatedAt` en varias tablas
Sin `updatedAt`: `HorarioBloque`, `ExcepcionFecha`, `PilotoDisponibilidadBloque`, `LogAuditoria`, `PantallaToken`.
→ Para auditoría y depuración, agregar `updatedAt @updatedAt` a las entidades editables (`ExcepcionFecha`, `PilotoDisponibilidadBloque`, `HorarioBloque`); LogAuditoria/PantallaToken son append-only/temporales y no lo necesitan.

### 2.6 Índices
Ya hay índices razonables (piloto: `activo`, `deletedAt`; vuelo: unique `[pilotoId, fechaHora]`, `fechaHora`, `estado`; reserva: `fechaReserva`, `estadoPago`, `deletedAt`; pago: `reservaId`, `fecha`; log: varios).
Mejoras sugeridas:
- **Reserva**: índices para búsquedas por `nombreTitular`, `email`, `telefono` (o índice trigram `pg_trgm` para búsquedas `ILIKE` de clientes).
- **Vuelo**: índice por `pasajeroId` (relación consultada en manifiestos/reportes).
- **Piloto**: índice por `prioridad` (orden default de la tabla y del matching).
- **ExcepcionFecha / PilotoDisponibilidadBloque**: el unique `[pilotoId, fecha]`/`[pilotoId, fecha, horaInicio]` ya cubre el acceso principal.
- **LogAuditoria**: considerar particionar por fecha cuando crezca.

### 2.7 Carga pesada en listados de pilotos
`pilotos.service.getAll` hace `include` de `excepciones` y `disponibilidadBloques` para **todos** los pilotos. Con muchos pilotos y muchos días es costoso.
→ Incluir esas relaciones solo cuando se abre el modal de disponibilidad (o paginar/filtrar por mes).

### 2.8 Estrategia de fechas/horarios
Las excepciones se guardan con `new Date('YYYY-MM-DDT00:00:00Z')` (UTC) pero la UI trabaja en hora local; los bloques son strings `HH:mm` sin zona horaria. Riesgo de desfases si se opera en otra zona.
→ Definir una política explícita (guardar en UTC, convertir en la UI, o guardar fecha como `date-only`) y documentarla.

### 2.9 Sin paginación en endpoints de listado
`GET /pilotos`, `GET /reservas`, `GET /vuelos`, logs, etc. devuelven todo sin paginar.
→ Agregar `skip/take` (o cursor) conforme crezcan los datos.

### 2.10 Prisma soft-delete no centralizado
Cada consulta filtra `deletedAt: null` manualmente (riesgo de olvidos en el futuro).
→ Implementar una extensión/middleware de Prisma para soft-delete transparente (ya está en el roadmap, Fase 4).

---

## 3. Plan sugerido (orden de prioridad)

1. **Financiero/operativo (crítico)**: `Reserva`, `Vuelo`, `Pago` → `version` + endpoints atómicos; mover dinero a `Decimal`. *(✅ Versión + endpoints atómicos hechos en Fase 1; dinero a `Decimal(12,2)` hecho en Fase 2 con serializer global que devuelve `number` y helper `toNum()`).*
2. **Enums en DB**: estadoPago/estadoVuelo/estado/tipo/categoria/metodoPago como enums Postgres. *(✅ Hecho en Fase 2: EstadoPago, EstadoVuelo, MetodoPago, TipoEquipo, EstadoEquipo, EstadoPista, CanalMensaje, CategoriaPiloto).*
3. **Soft delete + updatedAt** en `Gasto` y `ConfiguracionBloque`; `version` en `ConfiguracionBloque`. *(✅ Soft delete + updatedAt hechos en Fase 3 con extensión central de Prisma; `version` en ConfiguracionBloque → Fase 4).*
4. **CondicionPista / Gasto** → `version` + SSE (ya existe la infraestructura de `eventos.service`). *(✅ Hecho en Fase 4: version en CondicionPista, Gasto, ConfiguracionBloque, Equipo, MantenimientoEquipo; SSE en meteorología/gastos/equipos; 409 en configBloques y equipos).*
5. **Índices y paginación** cuando el volumen lo justifique. *(✅ Hecho en Fase 5: índices en reservas/vuelos/pilotos, paginación opcional, y `/pilotos` aligerado con carga on-demand de disponibilidad).*
6. **Pesos a `Int`** en DB (ya validado en Zod). *(✅ Hecho en Fase 2).*

---

## 5. Notas de modelado

- **Fechas/horarios**: la DB guarda timestamps UTC; la UI convierte a hora local. Los bloques horarios son strings `HH:mm` sin zona horaria (política explícita, Fase 5).

## 4. Referencias
- ADR 004: `docs/adr/004-sincronizacion-multicliente.md` (patrón de concurrencia optimista + SSE).
- Esquema: `apps/api/prisma/schema.prisma`.
- Tipos compartidos: `packages/shared/src/index.ts`.