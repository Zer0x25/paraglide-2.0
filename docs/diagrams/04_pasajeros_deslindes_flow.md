# Diagrama de Flujo: Módulo de Pasajeros y Deslindes Digitales (Waivers)

Este documento detalla el flujo de ejecución técnica para la consulta pública de fichas de pasajeros, captura y persistencia inmutable de firmas digitales de deslinde de responsabilidad (Waivers), gestión de versiones legales y actualización del estado de aptitud de vuelo en **Parapente School**.

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio del flujo de deslinde
    Start([Pasajero escanea QR o abre URL /deslinde/:token]) --> WebDeslinde[PWA Frontend: /deslinde/[token]]

    %% RAMA 1: CARGA DE DATOS PÚBLICOS
    WebDeslinde --> FetchPublic[GET /api/public/reservas/:id con tokenPublico / shortId]
    FetchPublic --> QueryDBReserva[(prisma.reserva.findFirst con pasajeros activos)]
    QueryDBReserva --> ExistsReserva{Reserva encontrada?}
    ExistsReserva -- No --> Err404Public([Retornar 404: Reserva no encontrada])
    ExistsReserva -- Si --> FetchVersionLegal[GET /api/public/deslinde-activo]
    FetchVersionLegal --> QueryDBDeslinde[(prisma.deslindeVersion.findFirst: activa = true)]
    QueryDBDeslinde --> RenderUI[Renderizar Formulario Legal y Declaracion de Salud en Next.js]

    %% RAMA 2: INTERACCIÓN Y VALIDACIÓN DE FORMULARIO
    RenderUI --> FormInput[Pasajero completa RUT/DNI, contacto de emergencia y condicion medica]
    FormInput --> SignatureCanvas[Pasajero dibuja firma en Canvas Tactil HTML5]
    SignatureCanvas --> SubmitSign[Pasajero pulsa Confirmar y Firmar]
    SubmitSign --> CheckCanvasEmpty{Canvas contiene trazos validos?}
    CheckCanvasEmpty -- No / Vacio --> ErrEmptyCanvas([Mostrar alerta UI: La firma es obligatoria])
    CheckCanvasEmpty -- Si --> ExportBase64[Exportar firma a String data:image/png;base64]
    ExportBase64 --> SendPost[POST /api/public/pasajeros/:id/firmar-deslinde]

    %% RAMA 3: PERSISTENCIA SEGURA EN BACKEND
    SendPost --> ValSignPayload[Validar FirmaDeslindePayloadSchema: firmaBase64, rutDni, contacto]
    ValSignPayload --> CheckSignSchema{Schema valido?}
    CheckSignSchema -- No --> Err400Sign([Retornar 400 Bad Request])
    CheckSignSchema -- Si --> FindPax[(prisma.pasajero.findFirst por tokenPublico / shortId / id)]
    FindPax --> ExistsPax{Pasajero existe?}
    ExistsPax -- No --> Err404Pax([Retornar 404 Not Found])
    ExistsPax -- Si --> TxSign[(Iniciar prisma.$transaction)]
    TxSign --> UpsertFirma[(tx.deslindeFirma.upsert con firmaBase64, IP, UserAgent, versionLegal)]
    UpsertFirma --> UpdatePax[(tx.pasajero.update: firmaDeslinde = true, firmaFecha = now)]
    UpdatePax --> CommitSign[Commit Transaccion]
    CommitSign --> AuditPax[logAudit: Registrar GUARDAR_FIRMA_DESLINDE]
    AuditPax --> OutSuccess([Retornar 200 OK con Pasajero Actualizado])
    OutSuccess --> UIConfirmation([UI muestra Comprobante Digital y estado APTO PARA VUELO])

    %% RAMA 4: ADMINISTRACIÓN LEGAL DE VERSIONES (ADMIN)
    AdminStart([Admin crea/edita version legal en /configuracion]) --> DeslindeAdminRoute[POST / PUT /api/deslindes]
    DeslindeAdminRoute --> ValAdminPayload[Validar CreateDeslindePayloadSchema]
    ValAdminPayload --> CheckIsActiva{Se marca como activa = true?}
    CheckIsActiva -- Si --> TxAdminLegal[(Iniciar prisma.$transaction)]
    TxAdminLegal --> DeactivateOthers[(tx.deslindeVersion.updateMany: activa = false)]
    DeactivateOthers --> CreateOrUpdateVer[(tx.deslindeVersion.create / update)]
    CreateOrUpdateVer --> CommitAdminLegal[Commit Transaccion Legal]
    CheckIsActiva -- No --> SingleSaveVer[(prisma.deslindeVersion.create / update)]
    CommitAdminLegal --> AuditLegal[logAudit: CREAR / EDITAR DESLINDE]
    SingleSaveVer --> AuditLegal
    AuditLegal --> OutAdminLegal([Retornar 200 / 201 con Version Legal])
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Punto de Entrada Frontend** | `apps/web/src/app/deslinde/[token]/page.tsx` | `DeslindePage` | Componente público Next.js |
| **Consulta Pública de Reserva** | `apps/api/src/routes/public.routes.ts` | `fastify.get('/reservas/:id')` | [`L88-L125`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/public.routes.ts#L88-L125) |
| **Consulta de Deslinde Activo** | `apps/api/src/routes/public.routes.ts` | `fastify.get('/deslinde-activo')` | [`L53-L59`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/public.routes.ts#L53-L59) |
| **Endpoint Firma de Deslinde** | `apps/api/src/routes/public.routes.ts` | `fastify.post('/pasajeros/:id/firmar-deslinde')` | [`L400-L460`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/public.routes.ts#L400-L460) |
| **Persistencia Inmutable de Firma** | `apps/api/src/routes/public.routes.ts` | `tx.deslindeFirma.upsert` | [`L417-L431`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/public.routes.ts#L417-L431) |
| **Actualización de Pasajero Apto** | `apps/api/src/routes/public.routes.ts` | `tx.pasajero.update` | [`L433-L454`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/public.routes.ts#L433-L454) |
| **Controller Interno de Pasajeros** | `apps/api/src/controllers/pasajeros.controller.ts` | `PasajerosController.guardarFirma` | [`L46-L57`](file:///home/zer0x/projects/paraglide/apps/api/src/controllers/pasajeros.controller.ts#L46-L57) |
| **Gestión de Versiones Legales** | `apps/api/src/routes/deslindes.ts` | `fastify.post('/')` | [`L26-L55`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/deslindes.ts#L26-L55) |
| **Invariante de Versión Activa Única** | `apps/api/src/routes/deslindes.ts` | `tx.deslindeVersion.updateMany: activa = false` | [`L35-L37, L91-L93`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/deslindes.ts#L35-L37) |
| **Inmutabilidad de Texto Activo** | `apps/api/src/routes/deslindes.ts` | `Guard: actual.activa => Error 400` | [`L75-L83`](file:///home/zer0x/projects/paraglide/apps/api/src/routes/deslindes.ts#L75-L83) |
