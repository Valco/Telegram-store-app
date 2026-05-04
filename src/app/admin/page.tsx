import prisma from '@/lib/prisma';
import Link from 'next/link';

export default async function AdminDashboard() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentSales = await prisma.order.aggregate({
    where: {
      status: { not: 'CANCELED' },
      createdAt: { gte: thirtyDaysAgo }
    },
    _sum: { finalAmount: true }
  });
  const totalSales = (recentSales._sum.finalAmount || 0) / 100;

  const newOrdersCount = await prisma.order.count({
    where: { status: 'PENDING' }
  });

  const tgUsersCount = await prisma.user.count({
    where: { telegramId: { not: null } }
  });

  const abandonedItemsAgg = await prisma.cartItem.aggregate({
    _sum: { quantity: true }
  });
  const abandonedItemsCount = abandonedItemsAgg._sum.quantity || 0;

  const latestOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 6,
    include: {
      user: { select: { firstName: true, lastName: true, phone: true } }
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Metric Card 1 */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/[0.07] transition-all group">
          <h3 className="text-neutral-400 text-sm font-medium mb-2">Сума Продажів (Місяць)</h3>
          <p className="text-3xl font-bold text-white group-hover:text-indigo-400 transition-colors">{totalSales.toFixed(2)} ₴</p>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/[0.07] transition-all group">
          <h3 className="text-neutral-400 text-sm font-medium mb-2">Нових Замовлень</h3>
          <p className="text-3xl font-bold text-white group-hover:text-purple-400 transition-colors">{newOrdersCount}</p>
        </div>

        {/* Metric Card 3 */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/[0.07] transition-all group">
          <h3 className="text-neutral-400 text-sm font-medium mb-2">Активні Користувачі ТГ</h3>
          <p className="text-3xl font-bold text-white group-hover:text-blue-400 transition-colors">{tgUsersCount}</p>
        </div>
        
        {/* Metric Card 4 */}
        <div className="bg-white/5 border border-amber-500/10 p-6 rounded-2xl hover:bg-white/[0.07] transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">🛒</div>
          <h3 className="text-neutral-400 text-sm font-medium mb-2">Покинуті Товари</h3>
          <div className="flex items-end gap-3">
            <p className="text-3xl font-bold text-white group-hover:text-amber-400 transition-colors">{abandonedItemsCount}</p>
            <span className="text-sm font-medium text-amber-500/50 mb-1">в кошиках</span>
          </div>
        </div>

      </div>

      <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            📋 Останні 6 Замовлень
          </h3>
          <Link href="/admin/orders" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">Всі замовлення &rarr;</Link>
        </div>
        
        {latestOrders.length === 0 ? (
          <div className="text-center py-10 text-neutral-500">Замовлень ще немає</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-white/10 text-neutral-400">
                  <th className="pb-3 pr-4 font-medium">Номер / ID</th>
                  <th className="pb-3 px-4 font-medium">Клієнт</th>
                  <th className="pb-3 px-4 font-medium">Сума</th>
                  <th className="pb-3 px-4 font-medium">Статус</th>
                  <th className="pb-3 pl-4 font-medium">Дата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {latestOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-white/[0.02]">
                    <td className="py-4 pr-4">
                      <Link href={`/admin/orders/${o.id}`} className="font-mono text-indigo-400 hover:underline">{o.orderNumber}</Link>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="text-white">{o.user?.firstName} {o.user?.lastName || ''}</span>
                        <span className="text-xs text-neutral-500">{o.user?.phone || 'Не вказано'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-emerald-400">{(o.finalAmount / 100).toFixed(2)} ₴</td>
                    <td className="py-4 px-4 text-white">
                      {o.status === 'PENDING' && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">Обробляється</span>}
                      {o.status === 'PAID' && <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">Оплачено</span>}
                      {o.status === 'SHIPPED' && <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">Відправлено</span>}
                      {o.status === 'DELIVERED' && <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs">Доставлено</span>}
                      {o.status === 'CANCELED' && <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">Скасовано</span>}
                    </td>
                    <td className="py-4 pl-4 text-neutral-400">{o.createdAt.toLocaleDateString('uk-UA')} {o.createdAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute:'2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
