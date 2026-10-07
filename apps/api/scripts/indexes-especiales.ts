import { prisma } from '../src/plugins/prisma';

// Pilar 4.3: índices que Prisma no puede expresar en schema.prisma
// (BRIN, pg_trgm GIN, parciales). Idempotente: se puede re-ejecutar.
// El deploy lo corre tras `prisma db push` (ver .github/workflows/deploy.yml).
async function main() {
  const sqls = [
    // Extensión trigram: habilita búsqueda textual eficiente (ILIKE '%…%')
    `CREATE EXTENSION IF NOT EXISTS pg_trgm`,

    // BRIN en fechaHora: la historia de vuelos crece sin límite; los scans por
    // rango de meses usan un índice ~1% del tamaño de un B-tree
    // Fix ghost slot: el índice único original @@unique([pilotoId, fechaHora]) bloqueaba slots de vuelos soft-deleted/cancelados
    // Se reemplaza por índice único parcial en deploy (schema.prisma ya es @@index)
    `DROP INDEX IF EXISTS "Vuelo_pilotoId_fechaHora_key"`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Vuelo_piloto_fechaHora_activos" ON "Vuelo" ("pilotoId", "fechaHora") WHERE "deletedAt" IS NULL AND "estado" <> 'CANCELADO'`,
    `CREATE INDEX IF NOT EXISTS "Vuelo_fechaHora_brin" ON "Vuelo" USING brin ("fechaHora")`,

    // Parcial sobre el compuesto caliente: todas las queries inyectan
    // deletedAt IS NULL (extensión soft-delete); el índice no incluye borrados
    `CREATE INDEX IF NOT EXISTS "Vuelo_fechaHora_estado_activos" ON "Vuelo" ("fechaHora", "estado") WHERE "deletedAt" IS NULL`,

    // pg_trgm GIN para las búsquedas q= de los listados (listar() con contains insensitive)
    `CREATE INDEX IF NOT EXISTS "Reserva_nombreTitular_trgm" ON "Reserva" USING gin ("nombreTitular" gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS "Pasajero_nombre_trgm" ON "Pasajero" USING gin ("nombre" gin_trgm_ops)`,
    `CREATE INDEX IF NOT EXISTS "Piloto_nombre_trgm" ON "Piloto" USING gin ("nombre" gin_trgm_ops)`,

    // Índices parciales para data caliente (Fase 2 de inmutabilidad y escalabilidad):
    // 1. Agendamiento y recepción activa: el 99% de las consultas no escanearán reservas históricas completadas
    `CREATE INDEX IF NOT EXISTS "Reserva_activas_fechaAgenda" ON "Reserva" ("fechaAgenda") WHERE "estado" IN ('SIN_AGENDAR', 'AGENDADA') AND "deletedAt" IS NULL`,
    // 2. Control de deudas y saldos pendientes: solo reservas abiertas sin completar ni cancelar
    `CREATE INDEX IF NOT EXISTS "Reserva_pendientes_pago" ON "Reserva" ("estadoPago", "valorTotal", "abono") WHERE "estado" NOT IN ('COMPLETADA', 'CANCELADA') AND "deletedAt" IS NULL`,
  ];

  for (const sql of sqls) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('OK  ', sql.slice(0, 90));
    } catch (err: any) {
      console.log('ERR ', sql.slice(0, 90), '->', err.message?.slice(0, 120));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
