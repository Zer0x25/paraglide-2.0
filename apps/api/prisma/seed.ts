import '../src/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedProd } from './seed.prod';

const prisma = new PrismaClient();

// SEED_INCLUDE_DEMO=false → solo prod (reglas/tarifas/promoción) sin pilotos/equipos/deslinde/meteo
const includeDemo = process.env.SEED_INCLUDE_DEMO !== 'false';

async function main() {
  const password = await bcrypt.hash('admin123', 10);
  
  // 1. Admin User
  const admin = await prisma.user.upsert({
    where: { email: 'admin@parapente.com' },
    update: {},
    create: {
      email: 'admin@parapente.com',
      password,
      nombre: 'Director de Vuelo',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin creado:', admin.email);

  // Demo data solo si includeDemo (dev). En prod (SEED_INCLUDE_DEMO=false) se omite.
  let piloto1: any = null;
  let piloto2: any = null;
  if (includeDemo) {
    // 2. Pilotos
    piloto1 = await prisma.piloto.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        nombre: 'Rodrigo Morales (Instructor Master)',
        rutDni: '12.345.678-5',
        telefono: '+56 9 8765 4321',
        email: 'rodrigo.morales@parapente.com',
        peso: 78,
        tieneLicencia: true,
        numeroLicencia: 'LIC-MASTER-001',
        fechaVencimientoLicencia: new Date(new Date().setFullYear(new Date().getFullYear() + 2)),
        prioridad: 1,
        categoria: 'MASTER',
        tarifaPorVuelo: 25000,
        disponibilidadTotal: true,
      }
    });

    piloto2 = await prisma.piloto.upsert({
      where: { id: 2 },
      update: {},
      create: {
        id: 2,
        nombre: 'Camila Sepúlveda (Piloto Senior)',
        rutDni: '23.456.789-4',
        telefono: '+56 9 7654 3210',
        email: 'camila.sepulveda@parapente.com',
        peso: 62,
        tieneLicencia: true,
        numeroLicencia: 'LIC-SENIOR-002',
        fechaVencimientoLicencia: new Date(new Date().setFullYear(new Date().getFullYear() + 2)),
        prioridad: 2,
        categoria: 'SENIOR',
        tarifaPorVuelo: 22000,
        disponibilidadTotal: true,
      }
    });

    console.log('✅ Pilotos creados:', piloto1.nombre, ',', piloto2.nombre);

    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"Piloto"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "Piloto"))`
    );

    // 3. Equipos de Vuelo
    const equipos = [
      {
        codigo: 'VELA-01',
        nombre: 'Ozone Magnum 3 41m²',
        tipo: 'VELA',
        marca: 'Ozone',
        modelo: 'Magnum 3',
        numeroSerie: 'MG3-41-9821',
        anoFabricacion: 2024,
        estado: 'OPERATIVO',
        horasVueloEstimadas: 34.5,
        vuelosRealizados: 86,
        limiteHorasInspeccion: 100,
        pilotoAsignadoId: piloto1.id,
      },
      {
        codigo: 'VELA-02',
        nombre: 'Advance BiBeta 6 41m²',
        tipo: 'VELA',
        marca: 'Advance',
        modelo: 'BiBeta 6',
        numeroSerie: 'BB6-41-5512',
        anoFabricacion: 2023,
        estado: 'OPERATIVO',
        horasVueloEstimadas: 68.0,
        vuelosRealizados: 170,
        limiteHorasInspeccion: 100,
        pilotoAsignadoId: piloto2.id,
      },
      {
        codigo: 'RES-01',
        nombre: 'Companion SQR 220 Tandem',
        tipo: 'PARACAIDAS_EMERGENCIA',
        marca: 'Companion',
        modelo: 'SQR 220',
        numeroSerie: 'SQR-220-4109',
        anoFabricacion: 2024,
        estado: 'OPERATIVO',
        horasVueloEstimadas: 34.5,
        vuelosRealizados: 86,
        limiteHorasInspeccion: 100,
        pilotoAsignadoId: piloto1.id,
      },
      {
        codigo: 'ARN-PIL-01',
        nombre: 'Woody Valley Bipax Pilot',
        tipo: 'ARNES_PILOTO',
        marca: 'Woody Valley',
        modelo: 'Bipax',
        anoFabricacion: 2024,
        estado: 'OPERATIVO',
        pilotoAsignadoId: piloto1.id,
      },
      {
        codigo: 'ARN-PAS-01',
        nombre: 'Woody Valley Passenger Pro',
        tipo: 'ARNES_PASAJERO',
        marca: 'Woody Valley',
        modelo: 'Passenger Pro',
        anoFabricacion: 2024,
        estado: 'OPERATIVO',
      }
    ];

    for (const eq of equipos) {
      await prisma.equipo.upsert({
        where: { codigo: eq.codigo },
        update: {},
        create: eq,
      });
    }
    console.log('✅ Equipos de vuelo inicializados');

    // 4. Estado Meteorológico Inicial
    const meteorologiaCount = await prisma.condicionPista.count();
    if (meteorologiaCount === 0) {
      await prisma.condicionPista.create({
        data: {
          estadoPista: 'ABIERTA',
          velocidadViento: 14,
          rachaViento: 18,
          direccionViento: 'SO',
          temperatura: 22,
          visibilidad: 'EXCELENTE',
          techoNubes: 1800,
          observaciones: 'Condiciones óptimas en pista de despegue.',
          registradoPor: 'Director de Vuelo',
        }
      });
      console.log('✅ Condición meteorológica inicial creada');
    }

    // Deslinde versión 1 (solo demo)
    const TEXTO_DESLINDE = `Declaro estar en condiciones de salud física y mental óptimas para realizar la actividad de vuelo en parapente en modalidad tándem.
Entiendo los riesgos inherentes a los deportes aéreos de aventura y acepto seguir estrictamente todas las instrucciones de seguridad impartidas por el piloto asignado.`;

    await prisma.$transaction(async (tx) => {
      const existente = await tx.deslindeVersion.findUnique({ where: { version: 1 } });
      if (!existente) {
        await tx.deslindeVersion.updateMany({ data: { activa: false } });
        await tx.deslindeVersion.create({
          data: {
            version: 1,
            titulo: 'Deslinde de Responsabilidad',
            texto: TEXTO_DESLINDE,
            activa: true,
          },
        });
        console.log('✅ Deslinde versión 1 creado (activo)');
      } else {
        console.log('ℹ️  Deslinde versión 1 ya existe, se conserva');
      }
    });
  } else {
    console.log('ℹ️  Demo data omitida (SEED_INCLUDE_DEMO=false)');
  }

  // 5. Módulo Configuración (prod mínimo, idempotente, respeta admin)
  await seedProd(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
