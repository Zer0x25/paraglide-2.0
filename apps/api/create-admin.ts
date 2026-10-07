import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'admin@parapente.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'admin@parapente.com',
      password: hashedPassword,
      nombre: 'Administrador Principal',
      role: 'ADMIN'
    }
  });

  console.log(`Usuario creado/actualizado: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
