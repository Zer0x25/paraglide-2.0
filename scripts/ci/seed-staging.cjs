// Se ejecuta por stdin dentro de la imagen API, únicamente contra la DB de staging.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname !== 'db' || url.port !== '5432' || url.pathname !== '/parapente_staging_db') {
    throw new Error('El seed de RC solo puede usar la base aislada de staging.');
  }
  const { STAGING_ADMIN_EMAIL: email, STAGING_ADMIN_PASSWORD: password } = process.env;
  if (!email || !password || password.length < 32)
    throw new Error('Faltan credenciales fuertes de staging.');
  const prisma = new PrismaClient();
  try {
    const hashed = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: { password: hashed, role: 'ADMIN' },
      create: { email, password: hashed, nombre: 'Administrador Staging', role: 'ADMIN' },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
