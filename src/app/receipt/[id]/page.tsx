import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import PrintButton from '@/components/PrintButton';

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        user: true
      }
    }),
    prisma.settings.findFirst()
  ]);

  if (!order) return redirect('/');

  const siteName = settings?.siteName || 'Telegram Store';
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  return (
    <main className="min-h-screen bg-neutral-200 p-4 md:p-8 flex justify-center items-start text-black">
      <div className="bg-white w-full max-w-md shadow-2xl p-8 pt-12 relative overflow-hidden receipt-paper">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black uppercase tracking-widest mb-1">{siteName}</h1>
          {siteUrl && <p className="text-neutral-500 text-sm">{siteUrl}</p>}
        </div>

        <div className="border-b-2 border-dashed border-neutral-300 pb-4 mb-6 space-y-2 text-sm font-mono text-neutral-600">
          <div className="flex justify-between">
            <span>ЧЕК №:</span>
            <span className="font-bold text-black truncate ml-4" title={order.orderNumber}>{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>ДАТА:</span>
            <span>{order.createdAt.toLocaleString('uk-UA')}</span>
          </div>
          <div className="flex justify-between">
            <span>КЛІЄНТ:</span>
            <span className="truncate ml-4">{order.user?.firstName || 'Гість'} {order.user?.lastName || ''}</span>
          </div>
          {order.paymentId && (
            <div className="flex justify-between">
              <span>ПЛАТІЖ:</span>
              <span className="truncate ml-4" title={order.paymentId}>{order.paymentId}</span>
            </div>
          )}
        </div>

        <table className="w-full mb-6 font-mono text-sm">
          <thead>
            <tr className="border-b border-neutral-300">
              <th className="text-left pb-2 font-normal text-neutral-500 w-[50%]">ТОВАР</th>
              <th className="text-right pb-2 font-normal text-neutral-500">КІЛ</th>
              <th className="text-right pb-2 font-normal text-neutral-500">СУМА</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map(item => {
              const hasRouletteDiscount = order.finalAmount < order.totalAmount && order.coinsUsed === 0;
              const discountRatio = order.finalAmount / order.totalAmount;
              const itemPrice = hasRouletteDiscount ? item.price * discountRatio : item.price;
              
              return (
                <tr key={item.id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-3 pr-2 leading-tight">
                    <div className="font-medium text-black line-clamp-2">{item.product.name}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {hasRouletteDiscount && <span className="line-through mr-1">{(item.price / 100).toFixed(2)}</span>}
                      {(itemPrice / 100).toFixed(2)} ₴ / шт
                    </div>
                  </td>
                  <td className="text-right py-3 align-top">{item.quantity}</td>
                  <td className="text-right py-3 align-top font-medium w-20">
                    <div className="flex flex-col items-end">
                      {hasRouletteDiscount && <span className="text-xs line-through text-neutral-400 font-normal">{(item.price * item.quantity / 100).toFixed(2)}</span>}
                      <span>{(itemPrice * item.quantity / 100).toFixed(2)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t-2 border-black pt-4 mb-8 font-mono space-y-1">
          <div className="flex justify-between text-sm items-center">
            <span>Підсумок:</span>
            <span>{(order.totalAmount / 100).toFixed(2)} ₴</span>
          </div>
          
          {order.coinsUsed > 0 && (
            <div className="flex justify-between text-sm items-center">
              <span>Монетами:</span>
              <span className="text-neutral-500">{(order.coinsUsed)} 🪙</span>
            </div>
          )}
          
          {(order.totalAmount > order.finalAmount) && (
            <div className="flex justify-between text-sm items-center">
              <span>Знижка:</span>
              <span>-{((order.totalAmount - order.finalAmount) / 100).toFixed(2)} ₴</span>
            </div>
          )}

          <div className="flex justify-between text-xl font-black mt-2 pt-2 border-t border-neutral-200">
            <span>ДО СПЛАТИ:</span>
            <span>{(order.finalAmount / 100).toFixed(2)} ₴</span>
          </div>
        </div>

        <div className="text-center text-xs font-mono text-neutral-500 mb-10 space-y-1">
          <p>ДЯКУЄМО ЗА ПОКУПКУ!</p>
          <p>Чек згенеровано автоматично</p>
        </div>

        <div className="flex flex-col gap-3 items-center justify-center print:hidden relative z-10 bg-neutral-50/50 p-2 rounded-xl">
          <PrintButton />
          <Link href={`/`} className="bg-neutral-200 text-black px-6 py-3 rounded-xl font-bold text-sm text-center w-full hover:bg-neutral-300 transition-colors shadow">
            Повернутись в магазин
          </Link>
        </div>
        
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white !important; padding: 0 !important; }
          .receipt-paper { box-shadow: none !important; max-w-none !important; width: 100% !important; padding: 0 !important; }
        }
      `}} />
    </main>
  );
}
