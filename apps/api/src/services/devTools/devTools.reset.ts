import { prisma } from '../../plugins/prisma';

export async function createAdminUser() {
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'admin@parapente.com',
      password: hashedPassword,
      nombre: 'Administrador Principal',
      role: 'ADMIN',
    },
  });
  return { success: true, user: { id: user.id, email: user.email } };
}

export async function resetDatabase() {
  await prisma.$transaction([
    prisma.mantenimientoEquipo.deleteMany({}),
    prisma.horarioBloque.deleteMany({}),
    prisma.configuracionBloque.deleteMany({}),
    prisma.equipo.deleteMany({}),
    prisma.logAuditoria.deleteMany({}),
    prisma.pantallaToken.deleteMany({}),
    prisma.plantillaMensaje.deleteMany({}),
    prisma.condicionPista.deleteMany({}),
    prisma.gasto.deleteMany({}),
    prisma.vuelo.deleteMany({}),
    prisma.pasajero.deleteMany({}),
    prisma.pago.deleteMany({}),
    prisma.reserva.deleteMany({}),
    prisma.excepcionFecha.deleteMany({}),
    prisma.pilotoDisponibilidadBloque.deleteMany({}),
    prisma.piloto.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  // Recrear el admin para que el entorno siga siendo usable tras el reset
  await createAdminUser();

  return { success: true, message: 'Base de datos borrada y administrador recreado (admin@parapente.com / admin123).' };
}
