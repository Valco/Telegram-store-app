import Link from 'next/link';
import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import CartClearer from './CartClearer';

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const { orderId } = await searchParams;
  
  if (!orderId) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white p-4 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-8 animate-[pulse_2s_ease-in-out_infinite]">
          <span className="text-5xl">✅</span>
        </div>
        <h1 className="text-4xl font-black mb-4 bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">Оплата Успішна!</h1>
        <p className="text-neutral-400 mb-8 max-w-md text-lg leading-relaxed">Дякуємо за замовлення!</p>
        <Link href="/" className="bg-indigo-500 hover:bg-indigo-600 px-10 py-4 rounded-2xl font-bold">Повернутись до покупок</Link>
      </main>
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { product: true }
      }
    }
  });

  if (!order) return redirect('/');

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 flex flex-col items-center pt-24">
      <CartClearer />
      <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 text-4xl">
        ✓
      </div>
      <h1 className="text-3xl md:text-4xl font-black mb-2 text-center leading-tight">Замовлення Прийнято!</h1>
      <p className="text-neutral-400 mb-6 max-w-md text-center">
        Номер вашого замовлення: <br/> <span className="font-bold text-white text-xl">{order.orderNumber}</span>
      </p>

      <div className="mb-8 max-w-md text-center w-full">
        {order.deliveryMethod === 'pickup_cherkasy' && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl shadow-lg">
            <h3 className="text-lg font-bold text-emerald-400 mb-2">Як отримати замовлення? 📦</h3>
            <p className="text-neutral-300 text-sm leading-relaxed mb-4">
              Оскільки більшість наших товарів виготовляється індивідуально, ми обов'язково надішлемо вам сповіщення, щойно все буде готово до видачі!
            </p>
            <div className="bg-black/30 p-4 rounded-xl border border-white/5 text-left">
              <span className="block text-xs text-neutral-500 uppercase tracking-widest font-bold mb-1">Точка видачі:</span>
              <span className="block font-bold text-white text-base">м. Черкаси, вул. Припортова, 34</span>
              <span className="block text-sm text-neutral-400 mb-2">ТЦ "Дніпро Плаза"</span>
              <span className="block text-sm text-neutral-300">Перший поверх, біля ескалатора — кавʼярня <strong className="text-white">«Coffee Point CHE»</strong>.</span>
            </div>
          </div>
        )}
        
        {order.deliveryMethod === 'nova_poshta' && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 p-5 rounded-2xl shadow-lg">
            <h3 className="text-lg font-bold text-indigo-400 mb-2">Що далі? 🚚</h3>
            <p className="text-neutral-300 text-sm leading-relaxed">
              Невдовзі наш менеджер обробить ваше замовлення та підготує його до відправки. Ми створимо електронну накладну "Нової Пошти" і відразу надішлемо вам номер ТТН для відстеження посилки!
            </p>
          </div>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 w-full max-w-lg mb-8 shadow-2xl">
        <h2 className="text-xl font-bold mb-4 border-b border-white/10 pb-4">Склад замовлення:</h2>
        <div className="space-y-4 mb-6">
          {order.items.map((item) => {
            const hasRouletteDiscount = order.finalAmount < order.totalAmount && order.coinsUsed === 0;
            const discountRatio = order.finalAmount / order.totalAmount;
            const itemPrice = hasRouletteDiscount ? item.price * discountRatio : item.price;
            
            return (
              <div key={item.id} className="flex flex-col gap-1">
                 <div className="flex justify-between items-start">
                   <span className="font-medium max-w-[70%]">{item.product.name}</span>
                   <div className="flex flex-col items-end">
                     {hasRouletteDiscount && (
                       <span className="font-mono text-sm text-neutral-500 line-through">{(item.price * item.quantity / 100).toFixed(2)} ₴</span>
                     )}
                     <span className="font-mono text-emerald-400 font-bold whitespace-nowrap ml-4">
                       {(itemPrice * item.quantity / 100).toFixed(2)} ₴
                     </span>
                   </div>
                 </div>
                 <span className="text-neutral-500 text-sm">
                   Кількість: {item.quantity} шт.
                 </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-white/10 pt-4 flex justify-between items-center text-lg">
          <span className="text-neutral-400">Всього до оплати:</span>
          <span className="font-black text-2xl text-emerald-400">{(order.finalAmount / 100).toFixed(2)} ₴</span>
        </div>

        {order.coinsUsed > 0 && (
          <div className="flex justify-between items-center text-sm mt-2">
           <span className="text-yellow-500/70">Списано монет:</span>
           <span className="text-yellow-500 font-bold">-{order.coinsUsed} 🪙</span>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
        <Link 
          href={`/receipt/${order.id}`} 
          className="flex-1 bg-white/10 hover:bg-white/20 text-white px-6 py-4 rounded-2xl font-bold text-center border border-white/10 transition-colors"
        >
          Електронний чек
        </Link>
        <Link 
          href="/" 
          className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-4 rounded-2xl font-bold text-center transition-transform hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
        >
          На головну
        </Link>
      </div>
    </main>
  );
}
