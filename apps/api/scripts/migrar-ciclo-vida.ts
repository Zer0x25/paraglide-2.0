import { prisma } from '../src/plugins/prisma';

/**
 * Fase 2 del ciclo de vida: migración de datos (Postgres 16) que lleva el
 * esquema al nuevo dominio:
 *  - EstadoPago gana 'DEVUELTO'.
 *  - EstadoReserva pasa de ACTIVA a 5 valores (SIN_AGENDAR, AGENDADA,
 *    COMPLETADA, CANCELADA, INCOMPLETA): ACTIVA → AGENDADA y se elimina ACTIVA.
 *  - Nueva tabla Devolucion (espejo de Pago) + columna denormalizada
 *    Reserva.montoDevuelto.
 *
 * Idempotente (IF NOT EXISTS / IF EXISTS): puede ejecutarse varias veces.
 * Estilo: mismo patrón try/catch con console.log OK/ERR que migrar-enums.ts.
 *
 * NOTA (verificado 2026-08-30 en PG 18.4): `ALTER TYPE ... DROP VALUE` da
 * syntax error 42601 vía Prisma raw en este servidor, aunque la documentación
 * lo soporte desde PG15. Por eso la eliminación de 'ACTIVA' se hace RECREANDO
 * el enum (rename + CREATE TYPE + cast por texto + drop del viejo), que es el
 * enfoque clásico y 100% robusto en cualquier versión.
 */
async function main() {
  const recrearEstadoReserva = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EstadoReserva' AND e.enumlabel = 'ACTIVA'
  ) THEN
    ALTER TABLE "Reserva" ALTER COLUMN "estado" DROP DEFAULT;
    ALTER TYPE "EstadoReserva" RENAME TO "EstadoReserva_old";
    CREATE TYPE "EstadoReserva" AS ENUM ('SIN_AGENDAR','AGENDADA','COMPLETADA','CANCELADA','INCOMPLETA');
    ALTER TABLE "Reserva" ALTER COLUMN "estado" TYPE "EstadoReserva" USING ("estado"::text::"EstadoReserva");
    ALTER TABLE "Reserva" ALTER COLUMN "estado" SET DEFAULT 'SIN_AGENDAR';
    DROP TYPE "EstadoReserva_old";
  END IF;
END $$;`;

  const sqls = [
    // 1) EstadoPago: nuevo valor DEVUELTO
    `ALTER TYPE "EstadoPago" ADD VALUE IF NOT EXISTS 'DEVUELTO'`,

    // 2) EstadoReserva: nuevos valores del ciclo de vida (los ADD VALUE hacen
    // el UPDATE ACTIVA→AGENDADA posible ANTES de recrear el tipo sin ACTIVA)
    `ALTER TYPE "EstadoReserva" ADD VALUE IF NOT EXISTS 'SIN_AGENDAR'`,
    `ALTER TYPE "EstadoReserva" ADD VALUE IF NOT EXISTS 'AGENDADA'`,
    `ALTER TYPE "EstadoReserva" ADD VALUE IF NOT EXISTS 'INCOMPLETA'`,

    // 3) Datos: las reservas ACTIVA pasan a AGENDADA (migración de datos)
    `UPDATE "Reserva" SET "estado" = 'AGENDADA' WHERE "estado" = 'ACTIVA'`,

    // 4) Recreación del enum sin 'ACTIVA' (idempotente, robusto en PG18)
    recrearEstadoReserva,

    // 5) Tabla Devolucion (espejo de Pago)
    `CREATE TABLE IF NOT EXISTS "Devolucion" (
      "id" SERIAL NOT NULL,
      "monto" DECIMAL(12,2) NOT NULL,
      "metodoPago" "MetodoPago" NOT NULL DEFAULT 'TRANSFERENCIA',
      "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "comprobante" TEXT,
      "notas" TEXT,
      "version" INTEGER NOT NULL DEFAULT 0,
      "reservaId" INTEGER NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL,
      "deletedAt" TIMESTAMPTZ,
      CONSTRAINT "Devolucion_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "Devolucion_reservaId_idx" ON "Devolucion"("reservaId")`,
    `CREATE INDEX IF NOT EXISTS "Devolucion_fecha_idx" ON "Devolucion"("fecha")`,
    `CREATE INDEX IF NOT EXISTS "Devolucion_deletedAt_idx" ON "Devolucion"("deletedAt")`,
    `ALTER TABLE "Devolucion" ADD CONSTRAINT "Devolucion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE`,

    // 6) Reserva.montoDevuelto denormalizado (como abono)
    `ALTER TABLE "Reserva" ADD COLUMN IF NOT EXISTS "montoDevuelto" DECIMAL(12,2) NOT NULL DEFAULT 0`,

    // 7) Default del estado: nuevas reservas nacen SIN_AGENDAR
    `ALTER TABLE "Reserva" ALTER COLUMN "estado" SET DEFAULT 'SIN_AGENDAR'`,
  ];

  for (const sql of sqls) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('OK  ', sql.slice(0, 110));
    } catch (err: any) {
      // Errores esperables en re-ejecución (p.ej. constraint ya existente por
      // IF NOT EXISTS no cubriéndolo en todas las versiones de PG): se loguean
      // pero no se aborta el script.
      console.log('ERR ', sql.slice(0, 110), '->', err.message?.slice(0, 140));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
