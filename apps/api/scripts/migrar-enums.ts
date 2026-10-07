import { prisma } from '../src/plugins/prisma';

async function main() {
  const sqls = [
    `CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE','ABONADO','PAGADO')`,
    `CREATE TYPE "EstadoVuelo" AS ENUM ('AGENDADO','COMPLETADO','CANCELADO')`,
    `CREATE TYPE "MetodoPago" AS ENUM ('TRANSFERENCIA','EFECTIVO','WEBPAY','TARJETA','OTRO')`,
    `CREATE TYPE "TipoEquipo" AS ENUM ('VELA','ARNES_PILOTO','ARNES_PASAJERO','PARACAIDAS_EMERGENCIA','CASCO','MOSQUETONES','OTRO')`,
    `CREATE TYPE "EstadoEquipo" AS ENUM ('OPERATIVO','EN_MANTENIMIENTO','REVISION_PENDIENTE','DE_BAJA')`,
    `CREATE TYPE "EstadoPista" AS ENUM ('ABIERTA','PRECAUCION','CERRADA')`,
    `CREATE TYPE "CanalMensaje" AS ENUM ('WHATSAPP','EMAIL','SMS')`,
    `CREATE TYPE "CategoriaPiloto" AS ENUM ('MASTER','SENIOR','JUNIOR','STANDARD')`,
    `ALTER TABLE "Reserva" ALTER COLUMN "estadoPago" DROP DEFAULT`,
    `ALTER TABLE "Reserva" ALTER COLUMN "estadoPago" TYPE "EstadoPago" USING ("estadoPago"::"EstadoPago")`,
    `ALTER TABLE "Reserva" ALTER COLUMN "estadoPago" SET DEFAULT 'PENDIENTE'::"EstadoPago"`,
    `ALTER TABLE "Vuelo" ALTER COLUMN "estado" DROP DEFAULT`,
    `ALTER TABLE "Vuelo" ALTER COLUMN "estado" TYPE "EstadoVuelo" USING ("estado"::"EstadoVuelo")`,
    `ALTER TABLE "Vuelo" ALTER COLUMN "estado" SET DEFAULT 'AGENDADO'::"EstadoVuelo"`,
    `ALTER TABLE "Pago" ALTER COLUMN "metodoPago" DROP DEFAULT`,
    `ALTER TABLE "Pago" ALTER COLUMN "metodoPago" TYPE "MetodoPago" USING ("metodoPago"::"MetodoPago")`,
    `ALTER TABLE "Pago" ALTER COLUMN "metodoPago" SET DEFAULT 'TRANSFERENCIA'::"MetodoPago"`,
    `ALTER TABLE "Equipo" ALTER COLUMN "tipo" DROP DEFAULT`,
    `ALTER TABLE "Equipo" ALTER COLUMN "tipo" TYPE "TipoEquipo" USING ("tipo"::"TipoEquipo")`,
    `ALTER TABLE "Equipo" ALTER COLUMN "tipo" SET DEFAULT 'VELA'::"TipoEquipo"`,
    `ALTER TABLE "Equipo" ALTER COLUMN "estado" DROP DEFAULT`,
    `ALTER TABLE "Equipo" ALTER COLUMN "estado" TYPE "EstadoEquipo" USING ("estado"::"EstadoEquipo")`,
    `ALTER TABLE "Equipo" ALTER COLUMN "estado" SET DEFAULT 'OPERATIVO'::"EstadoEquipo"`,
    `ALTER TABLE "CondicionPista" ALTER COLUMN "estadoPista" DROP DEFAULT`,
    `ALTER TABLE "CondicionPista" ALTER COLUMN "estadoPista" TYPE "EstadoPista" USING ("estadoPista"::"EstadoPista")`,
    `ALTER TABLE "CondicionPista" ALTER COLUMN "estadoPista" SET DEFAULT 'ABIERTA'::"EstadoPista"`,
    `ALTER TABLE "PlantillaMensaje" ALTER COLUMN "canal" DROP DEFAULT`,
    `ALTER TABLE "PlantillaMensaje" ALTER COLUMN "canal" TYPE "CanalMensaje" USING ("canal"::"CanalMensaje")`,
    `ALTER TABLE "PlantillaMensaje" ALTER COLUMN "canal" SET DEFAULT 'WHATSAPP'::"CanalMensaje"`,
    `ALTER TABLE "Piloto" ALTER COLUMN "categoria" DROP DEFAULT`,
    `ALTER TABLE "Piloto" ALTER COLUMN "categoria" TYPE "CategoriaPiloto" USING ("categoria"::"CategoriaPiloto")`,
    `ALTER TABLE "Piloto" ALTER COLUMN "categoria" SET DEFAULT 'MASTER'::"CategoriaPiloto"`,
    `ALTER TABLE "Piloto" ALTER COLUMN "peso" TYPE INTEGER USING ROUND("peso")::INTEGER`,
    `ALTER TABLE "Piloto" ALTER COLUMN "pesoMinimoPasajero" TYPE INTEGER USING ROUND("pesoMinimoPasajero")::INTEGER`,
    `ALTER TABLE "Piloto" ALTER COLUMN "pesoMaximoPasajero" TYPE INTEGER USING ROUND("pesoMaximoPasajero")::INTEGER`,
    `ALTER TABLE "Pasajero" ALTER COLUMN "peso" TYPE INTEGER USING ROUND("peso")::INTEGER`,
    `ALTER TABLE "Pasajero" ALTER COLUMN "pesoVerificado" TYPE INTEGER USING ROUND("pesoVerificado")::INTEGER`,
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
