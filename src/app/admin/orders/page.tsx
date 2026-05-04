import prisma from '@/lib/prisma';
import OrderClient from './OrderClient';

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
      items: {
        include: { product: true }
      }
    }
  });

  return <OrderClient orders={JSON.parse(JSON.stringify(orders, (k, v) => typeof v === 'bigint' ? v.toString() : v))} />;
}
