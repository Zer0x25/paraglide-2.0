-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PILOTO', 'RECEPCION');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'ABONADO', 'PAGADO', 'DEVUELTO');

-- CreateEnum
CREATE TYPE "EstadoVuelo" AS ENUM ('AGENDADO', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('SIN_AGENDAR', 'AGENDADA', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoPasajero" AS ENUM ('POR_VOLAR', 'VUELO_COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('TRANSFERENCIA', 'EFECTIVO', 'WEBPAY', 'TARJETA', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoEquipo" AS ENUM ('VELA', 'ARNES_PILOTO', 'ARNES_PASAJERO', 'PARACAIDAS_EMERGENCIA', 'CASCO', 'MOSQUETONES', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoEquipo" AS ENUM ('OPERATIVO', 'EN_MANTENIMIENTO', 'REVISION_PENDIENTE', 'DE_BAJA');

-- CreateEnum
CREATE TYPE "EstadoPista" AS ENUM ('ABIERTA', 'PRECAUCION', 'CERRADA');

-- CreateEnum
CREATE TYPE "CanalMensaje" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "CategoriaPiloto" AS ENUM ('MASTER', 'SENIOR', 'JUNIOR', 'STANDARD');

-- CreateEnum
CREATE TYPE "TipoDescuento" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');

-- CreateEnum
CREATE TYPE "CategoriaRegla" AS ENUM ('AGENDAMIENTO', 'SEGURIDAD', 'CONTACTO', 'PAGOS', 'PUNTO_ENCUENTRO');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "nombre" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RECEPCION',
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "googleId" TEXT,
    "pilotoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Piloto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "rutDni" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "peso" INTEGER,
    "tieneLicencia" BOOLEAN NOT NULL DEFAULT false,
    "numeroLicencia" TEXT,
    "fechaVencimientoLicencia" TIMESTAMP(3),
    "prioridad" INTEGER NOT NULL DEFAULT 1,
    "categoria" "CategoriaPiloto" DEFAULT 'MASTER',
    "pesoMinimoPasajero" INTEGER DEFAULT 30,
    "pesoMaximoPasajero" INTEGER DEFAULT 110,
    "disponibilidadTotal" BOOLEAN NOT NULL DEFAULT true,
    "tarifaPorVuelo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Piloto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExcepcionFecha" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "pilotoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExcepcionFecha_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotoDisponibilidadBloque" (
    "id" SERIAL NOT NULL,
    "pilotoId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PilotoDisponibilidadBloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" SERIAL NOT NULL,
    "numeroReserva" TEXT NOT NULL,
    "tokenPublico" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "rutDniTitular" TEXT,
    "nombreTitular" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "esGiftCard" BOOLEAN NOT NULL DEFAULT false,
    "fechaAgenda" TIMESTAMP(3),
    "horaAgenda" TEXT,
    "estadoPago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "estado" "EstadoReserva" NOT NULL DEFAULT 'SIN_AGENDAR',
    "motivoCancelacion" TEXT,
    "fechaCancelacion" TIMESTAMP(3),
    "valorTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "abono" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "montoDevuelto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "tarifaId" INTEGER,
    "promocionId" INTEGER,
    "cerradaAt" TIMESTAMP(3),
    "snapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pasajero" (
    "id" SERIAL NOT NULL,
    "numeroPasajero" TEXT NOT NULL,
    "tokenPublico" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "rutDni" TEXT,
    "nombre" TEXT NOT NULL,
    "peso" INTEGER,
    "telefono" TEXT,
    "contactoEmergencia" TEXT,
    "telefonoEmergencia" TEXT,
    "condicionFisica" TEXT,
    "pesoVerificado" INTEGER,
    "firmaDeslinde" BOOLEAN NOT NULL DEFAULT false,
    "firmaFecha" TIMESTAMP(3),
    "estado" "EstadoPasajero" NOT NULL DEFAULT 'POR_VOLAR',
    "reservaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pasajero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeslindeFirma" (
    "id" SERIAL NOT NULL,
    "pasajeroId" INTEGER NOT NULL,
    "firmaBase64" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "versionLegal" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeslindeFirma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vuelo" (
    "id" SERIAL NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL,
    "valorPactado" DECIMAL(12,2) NOT NULL,
    "pagoPiloto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estado" "EstadoVuelo" NOT NULL DEFAULT 'AGENDADO',
    "version" INTEGER NOT NULL DEFAULT 0,
    "reservaId" INTEGER NOT NULL,
    "pilotoId" INTEGER NOT NULL,
    "pasajeroId" INTEGER NOT NULL,
    "equipoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "googleEventId" TEXT,

    CONSTRAINT "Vuelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionBloque" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "fechaExacta" TIMESTAMP(3),
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "archivadaEn" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ConfiguracionBloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioBloque" (
    "id" SERIAL NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "configuracionBloqueId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HorarioBloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gasto" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "categoria" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "descripcion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" SERIAL NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobante" TEXT,
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "reservaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Devolucion" (
    "id" SERIAL NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "metodoPago" "MetodoPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comprobante" TEXT,
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "reservaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Devolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEquipo" NOT NULL DEFAULT 'VELA',
    "marca" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "anoFabricacion" INTEGER,
    "fechaAdquisicion" TIMESTAMP(3),
    "estado" "EstadoEquipo" NOT NULL DEFAULT 'OPERATIVO',
    "horasVueloEstimadas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vuelosRealizados" INTEGER NOT NULL DEFAULT 0,
    "limiteHorasInspeccion" DOUBLE PRECISION DEFAULT 100,
    "fechaUltimaRevision" TIMESTAMP(3),
    "fechaProximaRevision" TIMESTAMP(3),
    "notas" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "pilotoAsignadoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MantenimientoEquipo" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "taller" TEXT,
    "costo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "comprobante" TEXT,
    "equipoId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MantenimientoEquipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CondicionPista" (
    "id" SERIAL NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estadoPista" "EstadoPista" NOT NULL DEFAULT 'ABIERTA',
    "velocidadViento" DOUBLE PRECISION,
    "rachaViento" DOUBLE PRECISION,
    "direccionViento" TEXT,
    "temperatura" DOUBLE PRECISION,
    "visibilidad" TEXT DEFAULT 'EXCELENTE',
    "techoNubes" INTEGER,
    "nubosidad" INTEGER,
    "indiceUv" DOUBLE PRECISION,
    "observaciones" TEXT,
    "registradoPor" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CondicionPista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAuditoria" (
    "id" SERIAL NOT NULL,
    "fechaHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER,
    "usuarioEmail" TEXT,
    "usuarioNombre" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "descripcion" TEXT NOT NULL,
    "detalles" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantillaMensaje" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "canal" "CanalMensaje" NOT NULL DEFAULT 'WHATSAPP',
    "cuerpo" TEXT NOT NULL,
    "variables" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlantillaMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantallaToken" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "creadoPor" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PantallaToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarifa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(12,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promocion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipoDescuento" "TipoDescuento" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "fechaFin" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Promocion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" SERIAL NOT NULL,
    "pregunta" TEXT NOT NULL,
    "respuesta" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "publica" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeslindeVersion" (
    "id" SERIAL NOT NULL,
    "version" SERIAL NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "titulo" TEXT NOT NULL DEFAULT 'Deslinde de Responsabilidad',
    "texto" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeslindeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "slogan" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "logoUrl" TEXT,
    "horario" TEXT,
    "redesSociales" JSONB,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReglaOperativa" (
    "id" SERIAL NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "categoria" "CategoriaRegla" NOT NULL,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReglaOperativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionConfig" (
    "id" SERIAL NOT NULL,
    "recordatorio24hActivo" BOOLEAN NOT NULL DEFAULT true,
    "avisoClimaActivo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificacionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idempotencia" (
    "clientId" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "respuesta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Idempotencia_pkey" PRIMARY KEY ("clientId","metodo","url")
);

-- CreateTable
CREATE TABLE "FeedTokenRotacion" (
    "key" TEXT NOT NULL,
    "rotadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedTokenRotacion_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_pilotoId_key" ON "User"("pilotoId");

-- CreateIndex
CREATE UNIQUE INDEX "Piloto_email_key" ON "Piloto"("email");

-- CreateIndex
CREATE INDEX "Piloto_activo_idx" ON "Piloto"("activo");

-- CreateIndex
CREATE INDEX "Piloto_prioridad_idx" ON "Piloto"("prioridad");

-- CreateIndex
CREATE INDEX "Piloto_activo_prioridad_idx" ON "Piloto"("activo", "prioridad");

-- CreateIndex
CREATE INDEX "Piloto_deletedAt_idx" ON "Piloto"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExcepcionFecha_pilotoId_fecha_key" ON "ExcepcionFecha"("pilotoId", "fecha");

-- CreateIndex
CREATE INDEX "PilotoDisponibilidadBloque_pilotoId_fecha_idx" ON "PilotoDisponibilidadBloque"("pilotoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "PilotoDisponibilidadBloque_pilotoId_fecha_horaInicio_key" ON "PilotoDisponibilidadBloque"("pilotoId", "fecha", "horaInicio");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_numeroReserva_key" ON "Reserva"("numeroReserva");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_tokenPublico_key" ON "Reserva"("tokenPublico");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_shortId_key" ON "Reserva"("shortId");

-- CreateIndex
CREATE INDEX "Reserva_fechaAgenda_idx" ON "Reserva"("fechaAgenda");

-- CreateIndex
CREATE INDEX "Reserva_esGiftCard_idx" ON "Reserva"("esGiftCard");

-- CreateIndex
CREATE INDEX "Reserva_estadoPago_idx" ON "Reserva"("estadoPago");

-- CreateIndex
CREATE INDEX "Reserva_estadoPago_fechaAgenda_idx" ON "Reserva"("estadoPago", "fechaAgenda");

-- CreateIndex
CREATE INDEX "Reserva_estado_fechaAgenda_idx" ON "Reserva"("estado", "fechaAgenda");

-- CreateIndex
CREATE INDEX "Reserva_nombreTitular_idx" ON "Reserva"("nombreTitular");

-- CreateIndex
CREATE INDEX "Reserva_email_idx" ON "Reserva"("email");

-- CreateIndex
CREATE INDEX "Reserva_telefono_idx" ON "Reserva"("telefono");

-- CreateIndex
CREATE INDEX "Reserva_tarifaId_idx" ON "Reserva"("tarifaId");

-- CreateIndex
CREATE INDEX "Reserva_promocionId_idx" ON "Reserva"("promocionId");

-- CreateIndex
CREATE INDEX "Reserva_cerradaAt_idx" ON "Reserva"("cerradaAt");

-- CreateIndex
CREATE INDEX "Reserva_deletedAt_idx" ON "Reserva"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Pasajero_numeroPasajero_key" ON "Pasajero"("numeroPasajero");

-- CreateIndex
CREATE UNIQUE INDEX "Pasajero_tokenPublico_key" ON "Pasajero"("tokenPublico");

-- CreateIndex
CREATE UNIQUE INDEX "Pasajero_shortId_key" ON "Pasajero"("shortId");

-- CreateIndex
CREATE INDEX "Pasajero_reservaId_idx" ON "Pasajero"("reservaId");

-- CreateIndex
CREATE INDEX "Pasajero_deletedAt_idx" ON "Pasajero"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeslindeFirma_pasajeroId_key" ON "DeslindeFirma"("pasajeroId");

-- CreateIndex
CREATE INDEX "DeslindeFirma_pasajeroId_idx" ON "DeslindeFirma"("pasajeroId");

-- CreateIndex
CREATE INDEX "Vuelo_pilotoId_fechaHora_idx" ON "Vuelo"("pilotoId", "fechaHora");

-- CreateIndex
CREATE INDEX "Vuelo_fechaHora_estado_idx" ON "Vuelo"("fechaHora", "estado");

-- CreateIndex
CREATE INDEX "Vuelo_reservaId_idx" ON "Vuelo"("reservaId");

-- CreateIndex
CREATE INDEX "Vuelo_equipoId_idx" ON "Vuelo"("equipoId");

-- CreateIndex
CREATE INDEX "Vuelo_estado_idx" ON "Vuelo"("estado");

-- CreateIndex
CREATE INDEX "Vuelo_pasajeroId_idx" ON "Vuelo"("pasajeroId");

-- CreateIndex
CREATE INDEX "Vuelo_deletedAt_idx" ON "Vuelo"("deletedAt");

-- CreateIndex
CREATE INDEX "Vuelo_googleEventId_idx" ON "Vuelo"("googleEventId");

-- CreateIndex
CREATE INDEX "ConfiguracionBloque_archivada_idx" ON "ConfiguracionBloque"("archivada");

-- CreateIndex
CREATE INDEX "ConfiguracionBloque_deletedAt_idx" ON "ConfiguracionBloque"("deletedAt");

-- CreateIndex
CREATE INDEX "Gasto_fecha_idx" ON "Gasto"("fecha");

-- CreateIndex
CREATE INDEX "Gasto_categoria_idx" ON "Gasto"("categoria");

-- CreateIndex
CREATE INDEX "Gasto_fecha_categoria_idx" ON "Gasto"("fecha", "categoria");

-- CreateIndex
CREATE INDEX "Gasto_deletedAt_idx" ON "Gasto"("deletedAt");

-- CreateIndex
CREATE INDEX "Pago_reservaId_idx" ON "Pago"("reservaId");

-- CreateIndex
CREATE INDEX "Pago_fecha_idx" ON "Pago"("fecha");

-- CreateIndex
CREATE INDEX "Pago_deletedAt_idx" ON "Pago"("deletedAt");

-- CreateIndex
CREATE INDEX "Devolucion_reservaId_idx" ON "Devolucion"("reservaId");

-- CreateIndex
CREATE INDEX "Devolucion_fecha_idx" ON "Devolucion"("fecha");

-- CreateIndex
CREATE INDEX "Devolucion_deletedAt_idx" ON "Devolucion"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Equipo_codigo_key" ON "Equipo"("codigo");

-- CreateIndex
CREATE INDEX "Equipo_tipo_idx" ON "Equipo"("tipo");

-- CreateIndex
CREATE INDEX "Equipo_estado_idx" ON "Equipo"("estado");

-- CreateIndex
CREATE INDEX "Equipo_pilotoAsignadoId_idx" ON "Equipo"("pilotoAsignadoId");

-- CreateIndex
CREATE INDEX "Equipo_deletedAt_idx" ON "Equipo"("deletedAt");

-- CreateIndex
CREATE INDEX "MantenimientoEquipo_equipoId_idx" ON "MantenimientoEquipo"("equipoId");

-- CreateIndex
CREATE INDEX "MantenimientoEquipo_fecha_idx" ON "MantenimientoEquipo"("fecha");

-- CreateIndex
CREATE INDEX "MantenimientoEquipo_deletedAt_idx" ON "MantenimientoEquipo"("deletedAt");

-- CreateIndex
CREATE INDEX "CondicionPista_fechaHora_idx" ON "CondicionPista"("fechaHora");

-- CreateIndex
CREATE INDEX "CondicionPista_estadoPista_idx" ON "CondicionPista"("estadoPista");

-- CreateIndex
CREATE INDEX "CondicionPista_deletedAt_idx" ON "CondicionPista"("deletedAt");

-- CreateIndex
CREATE INDEX "LogAuditoria_fechaHora_idx" ON "LogAuditoria"("fechaHora");

-- CreateIndex
CREATE INDEX "LogAuditoria_entidad_idx" ON "LogAuditoria"("entidad");

-- CreateIndex
CREATE INDEX "LogAuditoria_accion_idx" ON "LogAuditoria"("accion");

-- CreateIndex
CREATE INDEX "LogAuditoria_usuarioEmail_idx" ON "LogAuditoria"("usuarioEmail");

-- CreateIndex
CREATE UNIQUE INDEX "PlantillaMensaje_tipo_key" ON "PlantillaMensaje"("tipo");

-- CreateIndex
CREATE INDEX "PlantillaMensaje_tipo_idx" ON "PlantillaMensaje"("tipo");

-- CreateIndex
CREATE INDEX "PlantillaMensaje_deletedAt_idx" ON "PlantillaMensaje"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PantallaToken_token_key" ON "PantallaToken"("token");

-- CreateIndex
CREATE INDEX "PantallaToken_tipo_expiraEn_idx" ON "PantallaToken"("tipo", "expiraEn");

-- CreateIndex
CREATE INDEX "PantallaToken_expiraEn_idx" ON "PantallaToken"("expiraEn");

-- CreateIndex
CREATE INDEX "Tarifa_deletedAt_idx" ON "Tarifa"("deletedAt");

-- CreateIndex
CREATE INDEX "Promocion_deletedAt_idx" ON "Promocion"("deletedAt");

-- CreateIndex
CREATE INDEX "Faq_orden_idx" ON "Faq"("orden");

-- CreateIndex
CREATE INDEX "Faq_deletedAt_idx" ON "Faq"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeslindeVersion_version_key" ON "DeslindeVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "ReglaOperativa_clave_key" ON "ReglaOperativa"("clave");

-- CreateIndex
CREATE INDEX "Idempotencia_createdAt_idx" ON "Idempotencia"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pilotoId_fkey" FOREIGN KEY ("pilotoId") REFERENCES "Piloto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExcepcionFecha" ADD CONSTRAINT "ExcepcionFecha_pilotoId_fkey" FOREIGN KEY ("pilotoId") REFERENCES "Piloto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotoDisponibilidadBloque" ADD CONSTRAINT "PilotoDisponibilidadBloque_pilotoId_fkey" FOREIGN KEY ("pilotoId") REFERENCES "Piloto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_tarifaId_fkey" FOREIGN KEY ("tarifaId") REFERENCES "Tarifa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_promocionId_fkey" FOREIGN KEY ("promocionId") REFERENCES "Promocion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pasajero" ADD CONSTRAINT "Pasajero_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeslindeFirma" ADD CONSTRAINT "DeslindeFirma_pasajeroId_fkey" FOREIGN KEY ("pasajeroId") REFERENCES "Pasajero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vuelo" ADD CONSTRAINT "Vuelo_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vuelo" ADD CONSTRAINT "Vuelo_pilotoId_fkey" FOREIGN KEY ("pilotoId") REFERENCES "Piloto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vuelo" ADD CONSTRAINT "Vuelo_pasajeroId_fkey" FOREIGN KEY ("pasajeroId") REFERENCES "Pasajero"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vuelo" ADD CONSTRAINT "Vuelo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorarioBloque" ADD CONSTRAINT "HorarioBloque_configuracionBloqueId_fkey" FOREIGN KEY ("configuracionBloqueId") REFERENCES "ConfiguracionBloque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipo" ADD CONSTRAINT "Equipo_pilotoAsignadoId_fkey" FOREIGN KEY ("pilotoAsignadoId") REFERENCES "Piloto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MantenimientoEquipo" ADD CONSTRAINT "MantenimientoEquipo_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

