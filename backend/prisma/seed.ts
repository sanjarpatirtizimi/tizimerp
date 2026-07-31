import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPhone = '+998900000001';
  const admin = await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      fullName: 'Super Admin',
      phone: adminPhone,
      passwordHash: await bcrypt.hash('ChangeMe123!', 12),
      role: UserRole.SUPER_ADMIN,
    },
  });

  const operatorPhone = '+998900000002';
  const operator = await prisma.user.upsert({
    where: { phone: operatorPhone },
    update: {},
    create: {
      fullName: 'Demo Operator',
      phone: operatorPhone,
      passwordHash: await bcrypt.hash('ChangeMe123!', 12),
      role: UserRole.OPERATOR,
    },
  });

  await prisma.product.upsert({
    where: { id: 'seed-tire-r15' },
    update: {},
    create: {
      id: 'seed-tire-r15',
      name: 'Tire R15',
      category: 'TIRE',
      unitPrice: 1000000,
      stockQty: 20,
    },
  });

  console.log('Seeded:', { admin: admin.phone, operator: operator.phone });
  console.log('Default password for both: ChangeMe123!  (change immediately)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
