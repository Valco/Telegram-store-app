import { PrismaClient, Role } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://dev_user:dev_password@localhost:5432/tel_bot_store?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Access Groups
  const groupsToCreate = [
    {
      name: 'Суперадмін',
      permissions: ['MANAGE_PRODUCTS', 'MANAGE_CATEGORIES', 'MANAGE_SETTINGS', 'MANAGE_RBAC', 'VIEW_ALL'],
    },
    {
      name: 'Адмін',
      permissions: ['MANAGE_PRODUCTS', 'MANAGE_CATEGORIES', 'MANAGE_SETTINGS', 'VIEW_ALL'],
    },
    {
      name: 'Менеджер',
      permissions: ['MANAGE_PRODUCTS', 'MANAGE_CATEGORIES', 'VIEW_ALL'],
    },
    {
      name: 'Глядач',
      permissions: ['VIEW_ALL'],
    },
  ];

  const accessGroups = [];
  for (const group of groupsToCreate) {
    const createdGroup = await prisma.accessGroup.upsert({
      where: { name: group.name },
      update: {},
      create: group,
    });
    accessGroups.push(createdGroup);
    console.log(`✅ Access Group created: ${createdGroup.name}`);
  }

  const [superAdminGroup] = accessGroups;

  // 2. Create test admin user (admin@tel.bot / test111, no OTP)
  const adminEmail = 'admin@tel.bot';
  const adminPassword = 'test111';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingAdmin) {
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        passwordHash: adminPassword,
        requiresOtp: false,
        role: Role.STAFF,
        accessGroupId: superAdminGroup.id,
      },
    });
    console.log(`👤 Admin updated: ${adminEmail}`);
  } else {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: adminPassword,
        requiresOtp: false,
        role: Role.STAFF,
        accessGroup: { connect: { id: superAdminGroup.id } },
      },
    });
    console.log(`👤 Admin created: ${adminEmail}`);
  }

  // 3. Create Categories
  const topCategories = ['Світильники', 'Іграшки', 'Меми', 'Підставки'];
  const createdCats: Record<string, any> = {};

  for (const catName of topCategories) {
    const slug = catName.toLowerCase().replace(/ /g, '-');
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name: catName, slug },
    });
    createdCats[catName] = category;
    console.log(`📂 Category created: ${category.name}`);
  }

  // Create Subcategory
  if (createdCats['Іграшки']) {
    await prisma.category.upsert({
      where: { slug: 'italian-brainrot' },
      update: {},
      create: {
        name: 'Italian Brainrot',
        slug: 'italian-brainrot',
        parentId: createdCats['Іграшки'].id,
      },
    });
    console.log(`📂 Sub-category created: Italian Brainrot (in Іграшки)`);
  }

  // 4. Create a sample Product
  const lightCategory = await prisma.category.findFirst({ where: { name: 'Світильники' } });
  
  if (lightCategory) {
    const productData = {
      name: 'Cyberpunk Neon Lamp',
      description: 'Ексклюзивна неонова лампа для ігрової кімнати з ефектом реакції на звук.',
      price: 340000, // 3400.00 UAH
      status: 'IN_STOCK' as any,
      madeToOrderDays: null,
      images: ['https://example.com/lamp1.jpg', 'https://example.com/lamp2.jpg'],
      videoUrl: 'https://example.com/lamp_demo.mp4',
      sizes: ['Medium', 'Large'],
      isPublished: true,
    };

    const product = await prisma.product.upsert({
      where: { id: 'seed-product-1' },
      update: productData,
      create: {
        id: 'seed-product-1',
        ...productData,
        category: { connect: { id: lightCategory.id } }
      }
    });
    console.log(`📦 Product created/updated: ${product.name}`);
  }

  console.log('✅ Seeding completed!');
  console.log('');
  console.log('Admin credentials:');
  console.log(`  Email:    ${adminEmail}`);
  console.log(`  Password: ${adminPassword}`);
  console.log(`  OTP:      disabled`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
