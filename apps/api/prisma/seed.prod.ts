import '../src/config';
import { PrismaClient } from '@prisma/client';

/**
 * Semilla de producción mínima (idempotente, respeta edición admin).
 * - Reglas: upsert con update:{} → no pisa valor editado
 * - Tarifas: createMany solo si tabla vacía
 * - Promoción Black Friday: findFirst por nombre → create si no existe
 * - Claves protegidas no borrables (validado en DELETE handler)
 */

export const CLAVES_PROTEGIDAS = [
  'puntoDeEncuentro',
  'telefonoContacto',
  'emailContacto',
] as const;

export const REGLAS_DEFAULT = [
  {
    clave: 'pesoMaximoPasajero',
    valor: '110',
    descripcion: 'Peso máximo permitido por pasajero para volar (kg)',
    categoria: 'SEGURIDAD' as const,
  },
  {
    clave: 'anticipacionHorasAgendamiento',
    valor: '2',
    descripcion: 'Horas mínimas de anticipación para agendar un vuelo',
    categoria: 'AGENDAMIENTO' as const,
  },
  {
    clave: 'telefonoContacto',
    valor: '+56 9 1234 5678',
    descripcion: 'Teléfono de contacto de la escuela',
    categoria: 'CONTACTO' as const,
  },
  {
    clave: 'emailContacto',
    valor: 'contacto@parapente.cl',
    descripcion: 'Email de contacto de la escuela',
    categoria: 'CONTACTO' as const,
  },
  {
    clave: 'puntoDeEncuentro',
    valor: 'Zona de Despegue',
    descripcion: 'Punto de encuentro por defecto para los pasajeros (editable por el admin).',
    categoria: 'PUNTO_ENCUENTRO' as const,
    esDefault: true,
  },
];

export const TARIFAS_DEFAULT = [
  { nombre: 'Vuelo Tándem Standard', precio: 80000, descripcion: 'Vuelo tándem clásico sobre la bahía.' },
  { nombre: 'Vuelo Tándem Premium + Fotos', precio: 100000, descripcion: 'Vuelo tándem con reportaje fotográfico incluido.' },
  { nombre: 'Vuelo Tándem + Video HD', precio: 120000, descripcion: 'Vuelo tándem con video HD y fotos.' },
];

export const PROMOCION_DEFAULT = {
  nombre: 'Black Friday',
  descripcion: 'Descuento fijo Black Friday',
  tipoDescuento: 'MONTO_FIJO' as const,
  valor: 20000,
  activa: true,
  fechaInicio: null as Date | null,
  fechaFin: null as Date | null,
};

export const BLOQUES_BASE_DEFAULT = {
  nombre: 'Horario Habitual',
  horarios: [
    { horaInicio: '09:00', horaFin: '11:00' },
    { horaInicio: '11:00', horaFin: '13:00' },
    { horaInicio: '14:00', horaFin: '16:00' },
    { horaInicio: '16:00', horaFin: '18:00' },
  ],
};

export async function seedProd(prisma: PrismaClient) {
  // Limpieza legacy: puntoDeEncuentro migró a PUNTO_ENCUENTRO
  await prisma.reglaOperativa.deleteMany({
    where: { clave: 'puntoDeEncuentro', NOT: { categoria: 'PUNTO_ENCUENTRO' } },
  });

  for (const regla of REGLAS_DEFAULT) {
    await prisma.reglaOperativa.upsert({
      where: { clave: regla.clave },
      // No pisar edición del admin: solo crear si no existe
      update: {},
      create: regla,
    });
  }
  console.log('✅ Reglas operativas (prod) inicializadas');

  const tarifasCount = await prisma.tarifa.count();
  if (tarifasCount === 0) {
    await prisma.tarifa.createMany({ data: TARIFAS_DEFAULT });
    console.log('✅ Tarifas (prod) creadas');
  } else {
    console.log('ℹ️  Tarifas ya existen, se conservan');
  }

  // Promoción: respetar edición/borrado admin — solo crear si no existe por nombre (incluye soft-deleted = no recrear)
  const promoExistente = await prisma.promocion.findFirst({
    where: { nombre: PROMOCION_DEFAULT.nombre },
  });
  if (!promoExistente) {
    await prisma.promocion.create({ data: PROMOCION_DEFAULT });
    console.log('✅ Promoción Black Friday creada');
  } else {
    console.log('ℹ️  Promoción Black Friday ya existe, se conserva');
  }

  // Configuración de bloques base: solo crear si no existe ninguna configuración
  const configBloquesCount = await prisma.configuracionBloque.count();
  if (configBloquesCount === 0) {
    await prisma.configuracionBloque.create({
      data: {
        nombre: BLOQUES_BASE_DEFAULT.nombre,
        fechaInicio: null,
        fechaFin: null,
        fechaExacta: null,
        bloqueado: false,
        horarios: {
          create: BLOQUES_BASE_DEFAULT.horarios,
        },
      },
    });
    console.log('✅ Configuración de bloques habitual inicializada');
  } else {
    console.log('ℹ️  Configuración de bloques ya existe, se conserva');
  }
}

// Ejecución directa: npx tsx prisma/seed.prod.ts
if (require.main === module) {
  const prisma = new PrismaClient();
  seedProd(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
