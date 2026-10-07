# Diagrama de Flujo: Módulo de Autenticación, Sesión Única y RBAC

Este documento modela la arquitectura de seguridad, autenticación (Local y Google OAuth2), el protocolo de **Sesión Única (Single Session - ADR 013)** para la revocación instantánea de credenciales obsoletas, la autorización por roles (RBAC) y el middleware de protección perimetral en **Parapente School**.

---

## 1. Diagrama de Flujo Técnico (`flowchart TD`)

```mermaid
flowchart TD
    %% Inicio del flujo de autenticación
    Start([Usuario intenta acceder al sistema]) --> ClientType{Canal de Entrada}

    %% RAMA 1: MIDDLEWARE PERIMETRAL EN NEXT.JS
    ClientType -- Navegacion Web Next.js --> WebMiddleware[apps/web/src/middleware.ts]
    WebMiddleware --> CheckPublicRoute{isPublicPath: /login, /pantalla, /voucher, /deslinde?}
    CheckPublicRoute -- Si --> CheckHasTokenLogin{Tiene cookie token e intenta ir a /login?}
    CheckHasTokenLogin -- Si --> RedirectHome([NextResponse.redirect a /])
    CheckHasTokenLogin -- No --> PassThroughPublic([NextResponse.next()])
    CheckPublicRoute -- No / Ruta Protegida --> CheckCookie{Cookie 'token' presente?}
    CheckCookie -- No --> RedirectLogin([NextResponse.redirect a /login?from=path])
    CheckCookie -- Si --> PassThroughProtected([NextResponse.next(): Servir vista protegida])

    %% RAMA 2: PROCESO DE LOGIN
    ClientType -- POST /api/auth/login --> AuthPayloadVal[Validar LoginPayload Zod: email y password]
    AuthPayloadVal --> QueryUser[(prisma.user.findFirst: email y deletedAt = null)]
    QueryUser --> UserExists{Usuario existe y activo?}
    UserExists -- No --> Err401Creds([Retornar 401: Credenciales invalidas])
    UserExists -- Si --> CheckHasPassword{user.password != null?}
    CheckHasPassword -- No --> ErrGoogleAccount([Retornar 401: Esta cuenta usa login con Google])
    CheckHasPassword -- Si --> BcryptCompare[bcrypt.compare: Comparar hash]
    BcryptCompare --> PasswordMatch{Contrasena valida?}
    PasswordMatch -- No --> Err401Creds
    PasswordMatch -- Si --> IncSessionVersion[(prisma.user.update: sessionVersion + 1)]
    IncSessionVersion --> SignJwt[fastify.jwt.sign con claims: id, email, role, pilotoId, sv]
    SignJwt --> SetHttpCookie[Retornar 200 OK con token y setear cookie en cliente]
    SetHttpCookie --> LoginSuccess([Sesion iniciada exitosamente])

    %% RAMA 3: PETICIÓN API PROTEGIDA (HOOK AUTHENTICATE)
    ClientType -- Peticion a Endpoint Protegido Fastify --> AuthHook[fastify.authenticate hook]
    AuthHook --> CheckApiKeyHeader{Header x-api-key presente y valido?}
    CheckApiKeyHeader -- Si / Service Token --> SetMcpContext[setMcpUser: user = id:0, role:RECEPCION, sv:0]
    SetMcpContext --> AuthorizeCheck
    CheckApiKeyHeader -- No --> VerifyJwt[request.jwtVerify: Decodificar y validar firma del JWT]
    VerifyJwt --> CheckJwtValid{Firma y expiracion validas?}
    CheckJwtValid -- No / Expirado --> Err401Jwt([Retornar 401 Unauthorized])
    CheckJwtValid -- Si --> AssertSessionValida[assertSessionValida: ADR 013 Single Session]
    AssertSessionValida --> QueryUserSv[(prisma.user.findUnique: id y deletedAt = null)]
    QueryUserSv --> CheckUserActive{Usuario existe y no eliminado?}
    CheckUserActive -- No --> Err401Revoked([Retornar 401 SESSION_REVOKED: Usuario inactivo])
    CheckUserActive -- Si --> CheckSvMatch{user.sessionVersion == decoded.sv?}
    CheckSvMatch -- No / Desactualizado --> Err401SessionRevoked([Retornar 401 SESSION_REVOKED: Sesion cerrada en otro dispositivo])
    CheckSvMatch -- Si / Coincide --> SetReqUser[request.user = decoded]

    %% RAMA 4: AUTORIZACIÓN POR ROLES (HOOK AUTHORIZE)
    SetReqUser --> AuthorizeCheck[fastify.authorize: Roles permitidos]
    AuthorizeCheck --> CheckRoleAllowed{request.user.role in rolesPermitidos?}
    CheckRoleAllowed -- No --> Err403Forbidden([Retornar 403 Forbidden: Permisos insuficientes])
    CheckRoleAllowed -- Si --> ExecHandler[Ejecutar Handler del Endpoint]
    ExecHandler --> OutApiSuccess([Retornar 200 / 201 con Datos])
```

---

## 2. Matriz de Referencia Cruzada: [Paso del Diagrama] -> [Código Fuente]

| Paso del Diagrama | Archivo / Ubicación | Función o Componente | Líneas de Código |
| :--- | :--- | :--- | :--- |
| **Middleware Perimetral Next.js** | `apps/web/src/middleware.ts` | `middleware(req)` | [`L18-L53`](file:///home/zer0x/projects/paraglide/apps/web/src/middleware.ts#L18-L53) |
| **Detección de Rutas Públicas** | `apps/web/src/utils/publicPaths.ts` | `isPublicPath(pathname)` | Shared utility |
| **Punto de Entrada AuthService** | `apps/api/src/services/auth.service.ts` | `AuthService.login` | [`L15-L65`](file:///home/zer0x/projects/paraglide/apps/api/src/services/auth.service.ts#L15-L65) |
| **Validación de Credenciales Local** | `apps/api/src/services/auth.service.ts` | `bcrypt.compare(payload.password, ...)` | [`L32-L38`](file:///home/zer0x/projects/paraglide/apps/api/src/services/auth.service.ts#L32-L38) |
| **Incremento Atómico sessionVersion** | `apps/api/src/services/auth.service.ts` | `tx / prisma.user.update: sessionVersion + 1` | [`L51-L54`](file:///home/zer0x/projects/paraglide/apps/api/src/services/auth.service.ts#L51-L54) |
| **Firma de JWT con Claim `sv`** | `apps/api/src/services/auth.service.ts` | `this.fastify.jwt.sign(...)` | [`L56-L60`](file:///home/zer0x/projects/paraglide/apps/api/src/services/auth.service.ts#L56-L60) |
| **Hook de Autenticación Fastify** | `apps/api/src/plugins/auth.ts` | `fastify.decorate('authenticate')` | [`L84-L97`](file:///home/zer0x/projects/paraglide/apps/api/src/plugins/auth.ts#L84-L97) |
| **Bypass de ApiKey para Agente MCP** | `apps/api/src/plugins/auth.ts` | `extractApiKey & setMcpUser` | [`L59-L77, L85-L89`](file:///home/zer0x/projects/paraglide/apps/api/src/plugins/auth.ts#L59-L77) |
| **Guard ADR 013 Single Session** | `apps/api/src/plugins/auth.ts` | `assertSessionValida(request, reply)` | [`L37-L57`](file:///home/zer0x/projects/paraglide/apps/api/src/plugins/auth.ts#L37-L57) |
| **Hook de Autorización RBAC** | `apps/api/src/plugins/auth.ts` | `fastify.decorate('authorize')` | [`L99-L125`](file:///home/zer0x/projects/paraglide/apps/api/src/plugins/auth.ts#L99-L125) |
