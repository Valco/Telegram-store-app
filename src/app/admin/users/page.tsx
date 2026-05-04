import prisma from '@/lib/prisma';
import UserClient from './UserClient';

export default async function UsersPage() {
  const roles = await prisma.accessGroup.findMany({
    include: {
      _count: {
        select: { users: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const staffUsers = await prisma.user.findMany({
    where: { role: 'STAFF' },
    include: { accessGroup: true },
    orderBy: { createdAt: 'desc' }
  });

  const bigIntReplacer = (key: string, value: any) => typeof value === 'bigint' ? value.toString() : value;
  
  const safeRoles = JSON.parse(JSON.stringify(roles, bigIntReplacer));
  const safeStaff = JSON.parse(JSON.stringify(staffUsers, bigIntReplacer));

  return (
    <div className="animate-in fade-in duration-500">
      <UserClient roles={safeRoles} staff={safeStaff} />
    </div>
  );
}
