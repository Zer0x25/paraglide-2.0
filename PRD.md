# Product Requirements Document (PRD) — Paraglide

**Documento:** PRD Maestro del Sistema  
**Producto:** Plataforma de Gestión de Reservas, Vuelos y Operaciones de Parapente  
**Versión:** 2.0  
**Estado:** Activo  
**Última Actualización:** 2026-10-07  

---

## 1. Visión y Propósito del Producto

**Paraglide** es la plataforma operativa y de reservas diseñada específicamente para escuelas de vuelo en parapente. Centraliza el ciclo de vida completo de la operación: desde la adquisición y agendamiento de vuelos biplaza tándem por parte de pasajeros, pasando por la gestión de caja, la firma digital de deslindes de responsabilidad (*waivers*), hasta la asignación de turnos y vuelos a pilotos en pista con soporte sin conexión (*offline-first*).

### Objetivos Clave de Negocio
1. **Cero Fricción en Pista**: Permitir a pilotos y coordinadores registrar despegues, turnos y firmas incluso sin señal de telefonía o internet en el despegue.
2. **Integridad Financiera y Operativa**: Control estricto de caja, tarifas, pagos a pilotos y márgenes con precisión decimal monetaria y control optimista de concurrencia.
3. **Escalabilidad Modular**: Arquitectura modular con un núcleo funcional abierto (Core) y extensiones avanzadas de alto valor (Premium).

---

## 2. Usuarios y Personas

| Rol / Persona | Descripción y Contexto de Uso | Necesidades Principales |
|---|---|---|
| **Pasajero** | Cliente final que realiza un vuelo biplaza. Interactúa desde móvil sin necesidad de crear cuenta. | Reservar fecha/hora, pagar online/seña, reagendar con autoservicio y firmar el deslinde digital en su propio teléfono o en tablet de pista. |
| **Piloto** | Profesional de vuelo en pista. Usa la app en su móvil (PWA) bajo condiciones de conectividad variable. | Ver turnos del día, confirmar despegue de reserva asignada, registrar pasajeros y sincronizar en segundo plano al recuperar señal. |
| **Recepción / Operador** | Personal de base y atención al cliente en el mostrador (desktop/tablet). | Asignar reservas a bloques de vuelo, cobrar saldos, registrar gastos operativos y monitorear el calendario en tiempo real. |
| **Administrador** | Dueño o director de operaciones de la escuela. | Configurar bloques y temporadas, gestionar pilotos y tarifas, consultar analíticas financieras y activar módulos premium. |

---

## 3. Alcance del Sistema (Core vs Premium)

Basado en la arquitectura modular de [ADR 003](docs/adr/003-modular-basica-premium.md):

### 3.1 Módulos Core (Siempre activos)
- **Inicio / Dashboard (`/`)**: Resumen de operaciones del día, estado del clima y accesos rápidos.
- **Reservas (`/reservas`)**: Listado paginado de reservas, creación rápida, cobros y cambios de estado.
- **Pilotos (`/pilotos`)**: Gestión de pilotos, turnos, categorías de vuelo y disponibilidad.
- **Calendario (`/calendario`)**: Visor interactivo por bloques de tiempo, slots disponibles y ocupación.
- **Analíticas (`/analiticas`)**: Métricas de demanda, facturación, márgenes operativos y registro de gastos.
- **Auditoría (`/auditoria`)**: Trazabilidad de operaciones críticas y cambios de estado.

### 3.2 Módulos Premium (Activación runtime vía `modules.config.json`)
- **Equipos y Velas**: Control de vida útil de parapentes, sillas y paracaídas de emergencia.
- **Reportes Avanzados**: Exportación de balances contables y liquidaciones a pilotos.
- **Meteorología Integrada**: Conexión con estaciones meteorológicas en vivo en despegue y aterrizaje.
- **Pantalla de Sala**: Vista pública para monitor de sala de espera con orden de turnos y llamadas.
- **Plantillas de Turnos**: Generación masiva de cronogramas estacionales.

---

## 4. Requisitos Funcionales Esenciales (RF)

- **RF-01: Gestión de Reservas y Estados**:
  - Creación con datos de contacto, cantidad de pasajeros y selección de bloque de vuelo.
  - Ciclo de vida: `PENDIENTE` ➔ `CONFIRMADA` ➔ `EN_ESPERA` ➔ `VOLANDO` ➔ `COMPLETADA` (o `CANCELADA`/`REAGENDADA`).
  - Identificadores seguros no secuenciales (`shortId` y `tokenPublico`) para vistas de pasajeros.
- **RF-02: Manejo de Dinero y Finanzas**:
  - Todo cálculo financiero (precio, seña, saldo, comisión de piloto) debe realizarse con tipo `Decimal(12,2)` y normalizarse vía `toNum()`. Prohibido redondeo nativo de float JS.
- **RF-03: Deslinde Digital de Responsabilidad**:
  - Firma en canvas táctil con guardado de trazo e IP/timestamp.
  - Accesible desde enlace público (`tokenPublico`) para firma previa desde el teléfono del pasajero.
- **RF-04: Concurrencia Optimista**:
  - Control de versión obligatorio en reservas (`version Int`). Si dos usuarios modifican la misma reserva en simultáneo, el segundo intento debe abortar con HTTP 409 Conflict y recargar la vista.
- **RF-05: Sincronización en Tiempo Real**:
  - Emisión de Server-Sent Events (SSE) tras confirmación de transacciones para actualizar clientes conectados sin recargar la página.
- **RF-06: Resiliencia Offline-First (PWA)**:
  - Cacheo en Service Worker de la shell de la aplicación y datos calientes.
  - Cola de salida (*Outbox*) en IndexedDB para mutaciones creadas sin conexión que se sincronizan de forma idempotente al reconectar.

---

## 5. Requisitos No Funcionales (RNF)

- **RNF-01: Aislamiento de Base de Datos**:
  - Entorno de desarrollo aislado en puerto `5679` (`docker-compose.dev-db.yml`).
  - Entorno de staging en puerto `5680` (`docker-compose.staging.yml`).
  - 🚨 **Prohibido terminantemente conectar herramientas o tests al puerto 5678** (Producción).
- **RNF-02: Contrato de API y Colecciones**:
  - Todo endpoint de colección debe seguir el sobre estándar `{ data: T[], pagination }` con helper `listar()` (ADR 005) y consumo vía `unwrapList`.
- **RNF-03: Separación de Lógica y UI**:
  - Componentes de interfaz desacoplados de la lógica mediante Headless Controller Hooks de menos de 300 líneas (ADR 014).
- **RNF-04: Diseño Visual y Accesibilidad**:
  - Tailwind CSS v4 con clases canónicas y tokens semánticos (sin clases arbitrarias ficticias).
  - Cumplimiento de WCAG AA y adaptabilidad garantizada en anchos móviles de 375px.

---

## 6. Criterios de Aceptación Globales

Cualquier incremento de producto se considera aceptado únicamente si cumple con:
1. **SDD**: Contratos de datos tipados en `@parapente/shared` con esquemas Zod exportados.
2. **BDD**: Escenarios de comportamiento definidos en `specs/` cubriendo camino feliz, casos borde y concurrencia.
3. **TDD**: Cobertura de pruebas unitarias y de integración que verifiquen los escenarios BDD.
4. **DoD**: Cumplimiento íntegro de la Definición de Terminado estipulada en [`AGENTS.md`](AGENTS.md).
5. **Estado**: Registro del resultado y estado en [`STATE.md`](STATE.md).
