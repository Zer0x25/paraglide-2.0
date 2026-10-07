# 🗺️ Mapa de Procesos End-to-End: Ciclo de Vida de Reserva a Vuelo y Liquidación

> **Rol**: Arquitectura de Soluciones & Análisis de Sistemas  
> **Sistema**: Parapente School (Booking & Flight Operations Core)  
> **Patrones Clave**: CQRS-lite, Concurrencia Híbrida (Optimista `version` + Pesimista `SELECT FOR UPDATE`), Idempotencia Outbox (ADR 009), Single Session (ADR 013), Event-Driven UI (SSE post-commit).

---

## 1. Resumen Ejecutivo y Visión del Macroproceso

El proceso medular del sistema **Parapente School** comprende la transformación integral de una intención comercial de vuelo en una operación aeronáutica ejecutada de manera segura, conforme a las normativas de deslinde legal, con asignación automatizada de recursos (pilotos y parapentes según umbrales de peso), control estricto de concurrencia y cierre financiero auditado sin redondeos espurios (`Decimal(12,2)`).

El flujo atraviesa **5 capas arquitectónicas** conectando múltiples actores: pasajeros que firman su deslinde en smartphones, recepcionistas que gestionan reservas y pagos en la PWA (incluso sin conexión gracias a una cola Outbox en IndexedDB), la torre de control que supervisa vuelos en tiempo real mediante Server-Sent Events (SSE), y agentes de IA que interactúan a través de un servidor Model Context Protocol (MCP).

---

## 2. Mapa de Procesos End-to-End (Swimlanes por Capas)

```mermaid
flowchart TD
    %% ==========================================================
    %% CAPA 1: CLIENTE / USUARIO
    %% ==========================================================
    subgraph CAPA_CLIENTE["📱 Capa de Cliente / Usuario (Frontend & Consumidores)"]
        direction TB
        UI_Recepcion["💻 Web App / PWA (Next.js 16)<br/>- AgendamientoRapidoModal<br/>- Dashboard / Calendario / Pagos<br/>- TanStack Query v5 + typedApi"]
        UI_Offline["📴 PWA Outbox Storage<br/>- IndexedDB (parapente-outbox)<br/>- useOnlineStatus / sync reactivo<br/>- Header X-Client-Id (ADR 009)"]
        UI_Pasajero["📱 Portal Móvil de Deslinde<br/>- URL Pública: /deslinde/[token]<br/>- Canvas táctil de firma Base64<br/>- Validación médica y DNI"]
        UI_Torre["📺 Pantalla TV de Espera<br/>- /pantalla (Ruta pública/TV)<br/>- useDatosStream / SSE listener<br/>- Semáforo pista & estado vuelos"]
        UI_AgenteIA["🤖 Agente IA Autónomo<br/>- Cliente MCP (apps/mcp)<br/>- Tools tipadas con x-api-key"]
    end

    %% ==========================================================
    %% CAPA 2: ENTRADA / CONTROLADORES & SEGURIDAD
    %% ==========================================================
    subgraph CAPA_ENTRADA["🚪 Capa de Entrada / Controladores (Fastify 5 & Middlewares)"]
        direction TB
        SEC_Auth["🔐 Auth & Perímetro de Seguridad<br/>- JWT Plugin & Fastify Auth<br/>- Guard Single Session (ADR 013 sessionVersion)<br/>- RBAC: ADMIN, PILOTO, RECEPCION"]
        SEC_Idempotencia["🛡️ Idempotencia Plugin (ADR 009)<br/>- Header X-Client-Id interceptor<br/>- Deduplicación mutaciones offline<br/>- TTL 7 días & cache hit directo"]
        CTRL_Reservas["🎮 ReservasController (/api/reservas)<br/>- POST / (Creación con Zod Schema)<br/>- PUT /:id (Edición con version Int)<br/>- POST /:id/pagos (Registro de abonos)"]
        CTRL_Public["🌐 PublicRoutes (/api/public)<br/>- GET /deslinde/:token (Lectura segura)<br/>- POST /deslinde/:token/firmar (Firma)"]
        CTRL_Vuelos["✈️ VuelosController (/api/vuelos)<br/>- POST /agendar-grupo (Despacho)<br/>- PUT /:id/estado (Máquina de estados)"]
        CTRL_SSE["📡 SSE Endpoint (/api/eventos)<br/>- Text/Event-Stream keep-alive<br/>- Filtro por token y canal"]
    end

    %% ==========================================================
    %% CAPA 3: DOMINIO / LÓGICA DE NEGOCIO
    %% ==========================================================
    subgraph CAPA_DOMINIO["⚙️ Capa de Dominio / Lógica de Negocio (Servicios & Casos de Uso)"]
        direction TB
        DOM_Precios["💰 Motor Tarifario & Precios<br/>- Decimal(12,2) con toNum()<br/>- Descuentos & Promociones vigentes<br/>- Derivación: PENDIENTE / ABONADO / PAGADO"]
        DOM_Concurrencia["⚡ Guard de Concurrencia Optimista<br/>- checkVersion(prev.version, req.version)<br/>- Retorno 409 Conflict si stale"]
        DOM_Slots["📅 Calendario & Resolución de Bloques<br/>- Jerarquía: EXACTA > RANGO > INDEFINIDO<br/>- Verificación de cupos & solapamientos"]
        DOM_Deslindes["✍️ Validación de Deslinde & Legalidad<br/>- Validación de integridad Base64<br/>- Huella digital: IP + UserAgent<br/>- Transición Pasajero a APTO_PARA_VUELO"]
        DOM_Matching["⚖️ Algoritmo de Matching Piloto-Vela<br/>- autoAssignVuelos: matching por pesos (Pax vs Vela)<br/>- Balanceo de carga y turnos de pilotos<br/>- Exclusión de pilotos sin licencia vigente"]
        DOM_VueloLock["🔒 Concurrencia Pesimista (Postgres)<br/>- SELECT id FROM Vuelo FOR UPDATE<br/>- Bloqueo atómico contra doble reserva de slot"]
        DOM_Lifecycle["🔄 Orquestador de Ciclo de Vida<br/>- Máquina de estados Reserva & Vuelo<br/>- Auto-cierre a COMPLETADA al finalizar vuelos"]
        DOM_Bitacora["🪂 Gestión de Equipos & Horas Vela<br/>- Acumulación horas vuelo en vela<br/>- Alerta mantenimiento (> 100 hrs)"]
    end

    %% ==========================================================
    %% CAPA 4: PERSISTENCIA & TRANSACCIONALIDAD
    %% ==========================================================
    subgraph CAPA_PERSISTENCIA["💾 Capa de Persistencia (PostgreSQL & Prisma ORM)"]
        direction TB
        DB_Tx["🧬 Transacción Atómica ACID<br/>- prisma.$transaction con rollback garantizado<br/>- Extensión Soft-Delete (deletedAt: null)"]
        DB_Entities[("🗄️ Tablas Principales de Dominio<br/>- Reserva (version, estado, estadoPago)<br/>- Pasajero (firmaDeslinde, tokenPublico)<br/>- DeslindeFirma (firmaBase64, ip, ua)<br/>- Vuelo (estado, pagoPiloto, fechaHora)<br/>- Pago (monto, metodo, comprobante)")]
        DB_Audit[("📜 Auditoría & Dedupe Storage<br/>- Tabla Auditoria (logAudit inmutable)<br/>- Tabla OutboxRespuesta (historial X-Client-Id)")]
    end

    %% ==========================================================
    %% CAPA 5: SERVICIOS EXTERNOS & EVENTOS ASÍNCRONOS
    %% ==========================================================
    subgraph CAPA_EXTERNA["🌐 Servicios Externos, Workers & Mensajería"]
        direction TB
        EXT_Meteo["🌤️ Open-Meteo Weather API<br/>- Consulta vientos, rachas y lluvia"]
        WORKER_Meteo["⏱️ MeteoScheduler (Worker cada 15 min)<br/>- Calcula semáforo: ABIERTA / PRECAUCION / CERRADA<br/>- Emite broadcastDatos('meteorologia')"]
        WORKER_Notif["⏰ NotificacionesScheduler (Worker cada 60 min)<br/>- Escaneo de vuelos en ventanas T-24h y T-2h<br/>- Inyección de plantillas seguras"]
        EXT_Omnicanal["📲 Pasarela Omnicanal Saliente<br/>- WhatsApp Business API / Twilio / Email<br/>- Despacho de vouchers y confirmaciones"]
        BUS_SSE["📢 SSE Event Bus (In-Memory Pub/Sub)<br/>- broadcastDatos(entidad, accion)<br/>- Emisión estricta POST-COMMIT de BD"]
    end

    %% ==========================================================
    %% RELACIONES Y FLUJO DE DATOS END-TO-END
    %% ==========================================================

    %% 1. Creación de Reserva
    UI_Recepcion -- "1. Solicita Reserva + Pasajeros (POST /api/reservas)" --> SEC_Auth
    UI_AgenteIA -- "1b. Agendamiento IA (x-api-key RECEPCION)" --> SEC_Auth
    UI_Offline -. "1c. Si offline: guarda en IndexedDB y envía al reconectar" .-> SEC_Idempotencia
    SEC_Auth --> SEC_Idempotencia
    SEC_Idempotencia --> CTRL_Reservas

    CTRL_Reservas --> DOM_Precios
    CTRL_Reservas --> DOM_Slots
    DOM_Precios --> DB_Tx
    DOM_Slots --> DB_Tx

    DB_Tx --> DB_Entities
    DB_Tx --> DB_Audit

    %% 2. Firma de Deslinde Legal
    DB_Entities -. "Genera tokenPublico no secuencial" .-> UI_Pasajero
    UI_Pasajero -- "2. Envía Firma Táctil (POST /api/public/deslinde/:token/firmar)" --> CTRL_Public
    CTRL_Public --> DOM_Deslindes
    DOM_Deslindes --> DB_Tx
    DOM_Deslindes -. "Pasajero pasa a APTO_PARA_VUELO" .-> DOM_Matching

    %% 3. Asignación y Despacho de Vuelo
    UI_Recepcion -- "3. Despachar / Agendar Grupo (POST /api/vuelos/agendar-grupo)" --> CTRL_Vuelos
    CTRL_Vuelos --> DOM_Concurrencia
    DOM_Concurrencia --> DOM_Matching
    DOM_Matching --> DOM_VueloLock
    DOM_VueloLock --> DB_Tx

    %% 4. Transición de Vuelo y Finalización
    UI_Recepcion -- "4. Actualizar Estado Vuelo (PUT /api/vuelos/:id/estado)" --> CTRL_Vuelos
    CTRL_Vuelos --> DOM_Lifecycle
    DOM_Lifecycle --> DOM_Bitacora
    DOM_Bitacora --> DB_Tx

    %% 5. Emisión de Eventos y Reactividad Post-Commit
    DB_Tx -- "5. Tras commit exitoso: dispara broadcastDatos" --> BUS_SSE
    BUS_SSE -- "Notifica mutación de 'reserva' y 'vuelo'" --> CTRL_SSE
    CTRL_SSE -. "Push reactivo (invalida TanStack Query)" .-> UI_Recepcion
    CTRL_SSE -. "Actualiza grilla en vivo" .-> UI_Torre

    %% 6. Workers Asíncronos y Servicios Externos
    EXT_Meteo --> WORKER_Meteo
    WORKER_Meteo -- "Actualiza EstadoPista en BD" --> DB_Tx
    WORKER_Meteo -- "broadcastDatos('meteorologia')" --> BUS_SSE
    
    DB_Entities -. "Lee vuelos próximos T-24h / T-2h" .-> WORKER_Notif
    WORKER_Notif --> EXT_Omnicanal
    EXT_Omnicanal -. "Notificación de vuelo y recordatorio" .-> UI_Pasajero
```

---

## 3. Trazabilidad Temporal: Secuencia del Ciclo de Vida End-to-End

El siguiente diagrama detalla la correlación temporal y el paso de mensajes a través de las capas durante las **4 etapas cardinales** de la operación:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 👤 Pasajero / Recepción
    participant Web as 💻 Web / PWA (Next.js 16)
    participant Outbox as 📴 Outbox (IndexedDB)
    participant API as 🚪 Fastify API (Controladores)
    participant Domain as ⚙️ Dominio (Precios/Matching)
    participant DB as 💾 PostgreSQL (Prisma $transaction)
    participant Workers as ⏱️ Workers (Meteo / Notif)
    participant SSE as 📢 Event Bus (SSE)

    %% ==========================================================
    %% FASE 1: Creación de la Reserva
    %% ==========================================================
    rect rgb(240, 248, 255)
        Note over Cliente, DB: FASE 1: Creación de Reserva & Cálculo Tarifario
        Cliente->>Web: Ingresa datos titular, pasajeros, paquete y fecha deseada
        alt Sin Conexión (Offline)
            Web->>Outbox: Guardar mutación con X-Client-Id UUID (ADR 009)
            Web-->>Cliente: Feedback optimista en UI (toast.info encolado)
            Outbox->>API: Replay automático al restablecer conexión
        else Online Directo
            Web->>API: POST /api/reservas (Header JWT + X-Client-Id)
        end
        API->>Domain: Validar Zod + Calcular valorTotal y saldo (Decimal 12,2)
        Domain->>Domain: Generar numeroReserva correlativo (AAMMDD-XX) y tokenPublico
        Domain->>DB: prisma.$transaction (Crear Reserva SIN_AGENDAR + Pasajeros POR_VOLAR)
        DB-->>Domain: Reserva creada con version = 0
        API-->>Web: 201 Created { data: Reserva, tokenPublico }
        Domain-)SSE: broadcastDatos('reserva', 'crear') POST-COMMIT
        SSE--)Web: Invalida queries ['reservas', 'dashboard']
    end

    %% ==========================================================
    %% FASE 2: Deslinde Legal Digital
    %% ==========================================================
    rect rgb(255, 250, 240)
        Note over Cliente, DB: FASE 2: Check-in, Deslinde Digital & Acondicionamiento Pista
        Workers->>API: MeteoScheduler evalúa viento/lluvia cada 15 min (Open-Meteo)
        API->>DB: Registra EstadoPista (ABIERTA / PRECAUCION / CERRADA)
        Cliente->>Web: Pasajero abre URL /deslinde/[tokenPublico] desde su móvil
        Web->>API: GET /api/public/deslinde/:token
        API-->>Web: 200 OK (Datos del pasajero sin exponer IDs internos)
        Cliente->>Web: Completa declaración de salud y dibuja firma en Canvas
        Web->>API: POST /api/public/deslinde/:token/firmar (Payload Canvas Base64)
        API->>Domain: Validar integridad, capturar IP y User-Agent
        Domain->>DB: prisma.$transaction (Insert DeslindeFirma + Pasajero firmaDeslinde = true)
        DB-->>Domain: Pasajero actualizado a estado APTO_PARA_VUELO
        Domain-)SSE: broadcastDatos('pasajero', 'actualizar')
        SSE--)Web: Pantalla de despacho y TV reflejan pasajero listo
    end

    %% ==========================================================
    %% FASE 3: Despacho de Vuelo & Concurrencia
    %% ==========================================================
    rect rgb(240, 255, 240)
        Note over Cliente, DB: FASE 3: Asignación por Pesos & Despacho con Lock Pesimista
        Cliente->>Web: Operador de torre selecciona pasajeros y pulsa "Despachar Grupo"
        Web->>API: POST /api/vuelos/agendar-grupo (reservaId, fechaHora, version)
        API->>Domain: Ejecutar autoAssignVuelos(pasajeros, pilotos, velas)
        Note over Domain: Matching seguro: pesoPax + pesoPiloto dentro del rango seguro de la Vela
        Domain->>DB: Inicia prisma.$transaction
        Domain->>DB: SELECT id FROM Vuelo WHERE ... FOR UPDATE (Lock pesimista)
        Domain->>Domain: Verificar version concurrencia optimista (reserva.version)
        alt Versión obsoleta (Stale data)
            Domain-->>API: ConflictError
            API-->>Web: 409 Conflict (Alerta de carrera, sincronizar datos)
        else Datos consistentes
            Domain->>DB: Crear registros Vuelo (estado: AGENDADO, pagoPiloto pactado)
            Domain->>DB: Actualizar Reserva (estado: AGENDADA, version = version + 1)
            DB-->>Domain: Commit exitoso de transacción
            Domain-)SSE: broadcastDatos('vuelo', 'crear') + broadcastDatos('reserva', 'actualizar')
            SSE--)Web: Grilla de vuelos y TV de espera actualizadas en tiempo real
        end
    end

    %% ==========================================================
    %% FASE 4: Ejecución, Cierre Financiero & Liquidación
    %% ==========================================================
    rect rgb(255, 240, 245)
        Note over Cliente, DB: FASE 4: Vuelo Completado, Bitácora, Saldo Cero & Liquidación
        Cliente->>Web: Piloto / Torre registra aterrizaje exitoso del vuelo
        Web->>API: PUT /api/vuelos/:id/estado { nuevoEstado: "COMPLETADO", version }
        API->>Domain: Transicionar máquina de estados de Vuelo
        Domain->>DB: Inicia prisma.$transaction con SELECT FOR UPDATE
        Domain->>DB: Vuelo.update(estado: COMPLETADO, version = version + 1)
        Domain->>DB: Pasajero.update(estado: VUELO_COMPLETADO)
        Domain->>DB: Equipo.update(horasVuelo = horasVuelo + deltaHoras)
        Domain->>Domain: Evaluar regla de auto-completado: ¿Todos los pasajeros volaron Y estadoPago == PAGADO?
        alt Reserva con saldo pendiente
            Domain->>DB: Reserva mantiene estado AGENDADA hasta recepción del pago final
        else Reserva 100% pagada
            Domain->>DB: Reserva.update(estado: COMPLETADA)
        end
        DB-->>Domain: Commit exitoso
        Domain-)SSE: broadcastDatos('vuelo', 'actualizar')
        Workers->>API: NotificacionesScheduler detecta vuelo completado
        Workers->>Cliente: Envío automático de agradecimiento y fotos vía WhatsApp/Email
        SSE--)Web: Dashboard y analíticas reflejan KPI actualizado
    end
```

---

## 4. Matriz de Transición de Estados de Entidades Clave

El sistema orquesta estados concurrentes acoplados a reglas de negocio inmutables:

| Entidad | Estado Inicial | Transiciones Posibles | Estado Final | Regla / Detonante del Sistema |
| :--- | :--- | :--- | :--- | :--- |
| **Reserva** | `SIN_AGENDAR` | `→ AGENDADA`<br/>`→ CANCELADA` | `COMPLETADA` | Pasa a `AGENDADA` cuando sus vuelos son programados. Solo transiciona a `COMPLETADA` si **todos** sus pasajeros tienen estado `VUELO_COMPLETADO` y el `estadoPago` es `PAGADO`. |
| **Estado Pago** | `PENDIENTE` | `→ ABONADO`<br/>`→ PAGADO`<br/>`→ DEVUELTO` | `PAGADO` / `DEVUELTO` | Calculado estrictamente con `toNum()` sobre `Decimal(12,2)`: Si `abono == 0` es `PENDIENTE`; si `0 < abono < valorTotal` es `ABONADO`; si `abono >= valorTotal` es `PAGADO`. Si `montoDevuelto > 0` deriva a `DEVUELTO`. |
| **Pasajero** | `POR_VOLAR` | `→ VUELO_COMPLETADO`<br/>`→ CANCELADO` | `VUELO_COMPLETADO` | Requiere `firmaDeslinde: true` (`APTO_PARA_VUELO`) para habilitar el despegue en el algoritmo de matching. |
| **Vuelo** | `AGENDADO` | `→ COMPLETADO`<br/>`→ CANCELADO` | `COMPLETADO` | Controlado por `SELECT FOR UPDATE` en Postgres para evitar condiciones de carrera en el slot del piloto (`@@unique([pilotoId, fechaHora])`). |
| **Pista (Meteo)** | `ABIERTA` | `→ PRECAUCION`<br/>`→ CERRADA` | Dinámico | Evaluado cada 15 min por `MeteoScheduler` contra umbrales meteorológicos de viento (> 35 km/h = CERRADA) y lluvia. |

---

## 5. Entradas y Salidas de Negocio (Inputs & Outputs)

### 📥 Entradas de Negocio (Business Inputs)
1. **Solicitud de Reserva**: Nombre y RUT/DNI del titular, email, teléfono, fecha/rango deseado, paquete de vuelo y nómina de pasajeros (nombre, peso estimado en kg, teléfonos).
2. **Registro de Abonos / Pagos**: Monto en `Decimal(12,2)`, método de pago (`TRANSFERENCIA`, `WEBPAY`, `EFECTIVO`, `TARJETA`), identificador de transacción bancaria o comprobante.
3. **Deslinde Legal Táctil**: Trazo vectorial / imagen en Base64 de la firma del pasajero, declaración jurada médica (enfermedades cardíacas, cirugías recientes, embarazo), huella de auditoría del navegador (dirección IP del cliente y User-Agent).
4. **Parámetros Operativos de Despacho**: Selección de slot temporal en bloque horario, asignaciones manuales o sugeridas por el motor de matching de pilotos y números de serie de velas.
5. **Telemetría Meteorológica**: Datos en tiempo real de la API Open-Meteo (velocidad de viento base en km/h, rachas máximas, dirección cardinal en grados y probabilidad de precipitación).

### 📤 Salidas de Negocio (Business Outputs)
1. **Identificadores y Tokens Seguros**:
   - `numeroReserva`: Código correlativo único institucional en formato `AAMMDD-XX` (con control de colisión y reintentos P2002 con jitter).
   - `tokenPublico` & `shortId`: Hashes no secuenciales para consulta de deslinde y voucher público sin fugar IDs secuenciales de base de datos.
2. **Expediente de Deslinde Legal Digital**: Documento legal inmutable con firma estampada, timestamp verificado, versión de bases y condiciones, e IP de captura para blindaje ante reclamaciones legales.
3. **Hoja de Despacho y Asignación Aeronáutica**: Asignaciones validadas respetando el peso máximo de despegue (MTOW) de cada vela y balanceando las horas de fatiga entre los pilotos de turno.
4. **Liquidación y Bitácora de Vuelo**:
   - Registro de minutos/horas de vuelo sumados a la vela (con disparo de alertas de inspección periódica a las 100 horas).
   - Abono de honorarios al piloto (`pagoPiloto`) registrado para el cierre de caja de la jornada.
5. **Sincronización Reactiva Multicliente**: Broadcast SSE (`datos-cambios`) que actualiza la TV de la sala de espera y las sesiones de administración concurrentes en < 100 ms sin sobrecargar con polling innecesario.
6. **Despacho Omnicanal**: Notificaciones automatizadas de confirmación y recordatorio a las 24 horas y 2 horas previas enviadas al pasajero vía WhatsApp / Email.

---

## 6. Módulos y Directorios del Proyecto Involucrados

| Etapa del Proceso | Módulos & Directorios Clave | Archivos Específicos | Responsabilidad Técnica |
| :--- | :--- | :--- | :--- |
| **Frontend, PWA & Resiliencia** | `apps/web/src/app`<br/>`apps/web/src/components`<br/>`apps/web/src/services/outbox`<br/>`apps/web/src/hooks` | `reservas/page.tsx`<br/>`AgendamientoRapidoModal.tsx`<br/>`outbox.service.ts`<br/>`useOnlineStatus.ts`<br/>`useDatosStream.ts` | Captura UI, gestión de caché con TanStack Query v5, resiliencia offline en IndexedDB con deduplicación por `X-Client-Id` y suscripción al canal SSE. |
| **Portal Público de Deslinde** | `apps/web/src/app/deslinde`<br/>`apps/web/src/components/deslinde` | `[token]/page.tsx`<br/>`CanvasFirma.tsx` | Renderizado responsive móvil, captura de firma táctil y envío desacoplado sin requerir login de usuario. |
| **Control de Acceso & Perímetro** | `apps/api/src/plugins`<br/>`apps/api/src/services` | `plugins/auth.ts`<br/>`plugins/idempotencia.plugin.ts`<br/>`auth.service.ts` | Validación de JWT, verificación de sesión única (`sessionVersion` ADR 013), control de idempotencia de mutaciones offline (ADR 009). |
| **Gestión de Reservas y Pagos** | `apps/api/src/routes`<br/>`apps/api/src/services/reservas`<br/>`packages/shared/src` | `routes/reservas.ts`<br/>`reservas.crud.ts`<br/>`reservas.ciclo-vida.ts`<br/>`reservas.precios.ts`<br/>`money.util.ts` | Validación con esquemas Zod, cálculo de tarifas con `Decimal(12,2)`, correlativo `AAMMDD-XX`, y derivación de estados de pago. |
| **Deslindes & Pasajeros** | `apps/api/src/routes`<br/>`apps/api/src/services` | `routes/deslindes.ts`<br/>`routes/public.routes.ts`<br/>`pasajeros.service.ts` | Recepción de firmas en Base64, inmutabilidad jurídica y paso de pasajeros a estado apto para vuelo. |
| **Operaciones de Vuelo & Despacho**| `apps/api/src/routes`<br/>`apps/api/src/services/vuelos` | `routes/vuelos.ts`<br/>`vuelos.crud.ts`<br/>`vuelos.matching.ts`<br/>`vuelos.lifecycle.ts` | Algoritmo de asignación por peso, bloqueo de concurrencia pesimista (`FOR UPDATE`), máquina de estados de vuelo y cierre de reservas. |
| **Equipos, Velas & Pilotos** | `apps/api/src/services` | `equipos.service.ts`<br/>`pilotos.service.ts` | Control de horas acumuladas de las velas, control de inspección preventiva y tarifas/turnos de los pilotos. |
| **Persistencia & Modelo de Datos** | `apps/api/prisma` | `schema.prisma`<br/>`prisma.ts` | Esquema relacional PostgreSQL, llaves compuestas (`@@unique([pilotoId, fechaHora])`), soft-delete automático y transacciones ACID. |
| **Meteorología & Workers de Fondo** | `apps/api/src/services` | `openMeteo.service.ts`<br/>`meteorologia.service.ts`<br/>`meteoScheduler.service.ts` | Polling periódico (15 min) a Open-Meteo, derivación de semáforo de pista y persistencia de métricas atmosféricas. |
| **Notificaciones Omnicanal** | `apps/api/src/services` | `notificacionesScheduler.service.ts`<br/>`notificaciones.service.ts`<br/>`plantillas.service.ts` | Worker cada 60 min, detección de ventanas horarias (24h/2h) y ensamblado de plantillas seguras. |
| **Servidor MCP (Agentes IA)** | `apps/mcp/src` | `server.ts`<br/>`client/api-client.ts`<br/>`tools/reservas.ts` | Exposición de herramientas estructuradas vía JSON-RPC sobre stdio/SSE para agentes inteligentes con rol `RECEPCION`. |
