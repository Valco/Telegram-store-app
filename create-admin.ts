import prisma from './src/lib/prisma';

async function main() {
  const email = 'admin@tel.bot';
  const password = 'test111';

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: password,
        requiresOtp: false,
        role: 'STAFF',
      }
    });
    console.log("✅ Created test admin:", user.email);
  } else {
    user = await prisma.user.update({
      where: { email },
      data: {
        passwordHash: password,
        requiresOtp: false,
        role: 'STAFF'
      }
    });
    console.log("✅ Updated test admin:", user.email);
  }

  console.log('');
  console.log('Admin credentials:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  OTP:      disabled`);
}

main()
  .then(async () => {})
  .catch(async (e) => {
    console.error(e)
    process.exit(1)
  })
