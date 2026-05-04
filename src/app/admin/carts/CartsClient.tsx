'use client';

import { useState } from 'react';
import { sendCartReminder } from './actions';

export default function CartsClient({ carts }: { carts: any[] }) {
  const [loadingIds, setLoadingIds] = useState<string[]>([]);
  const [successIds, setSuccessIds] = useState<string[]>([]);
  const [errorIds, setErrorIds] = useState<Record<string, string>>({});

  const handleSendPush = async (userId: string, cartId: string) => {
    setLoadingIds(prev => [...prev, cartId]);
    setErrorIds(prev => { const next = {...prev}; delete next[cartId]; return next; });

    const res = await sendCartReminder(userId);
    
    if (res.success) {
      setSuccessIds(prev => [...prev, cartId]);
    } else {
      setErrorIds(prev => ({ ...prev, [cartId]: res.error || 'Помилка' }));
    }
    
    setLoadingIds(prev => prev.filter(id => id !== cartId));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {carts.map((cart: any) => {
        let total = 0;
        cart.items.forEach((item: any) => {
           total += item.product.price * item.quantity;
        });

        const isLoading = loadingIds.includes(cart.id);
        const isSuccess = successIds.includes(cart.id);
        const error = errorIds[cart.id];

        return (
          <div key={cart.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors">
            <div className="flex justify-between items-start mb-4">
               <div>
                 <h3 className="font-bold text-white">{cart.user?.firstName || 'Невідомий'}</h3>
                 <p className="text-xs text-neutral-500">@{" "}{cart.user?.username || '-'}</p>
               </div>
               <div className="text-right">
                 <p className="text-sm font-bold text-emerald-400">{(total / 100).toFixed(2)} ₴</p>
                 <p className="text-[10px] text-neutral-500">Сума кошика</p>
               </div>
            </div>

            <div className="space-y-2 mb-4">
              {cart.items.map((item: any) => (
                <div key={item.id} className="flex justify-between text-xs text-neutral-300 bg-black/20 p-2 rounded-lg">
                  <span className="truncate pr-2">{item.product?.name}</span>
                  <span className="flex-shrink-0">{item.quantity} шт.</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => handleSendPush(cart.userId, cart.id)}
              disabled={isLoading || isSuccess}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                isSuccess 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-default'
                  : error
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30'
                    : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30'
              }`}
            >
              {isLoading ? 'Відправка...' : isSuccess ? '✅ Надіслано' : error ? `❌ ${error} (Спробувати ще)` : 'Надіслати Push в Telegram'}
            </button>
          </div>
        );
      })}

      {carts.length === 0 && (
        <div className="col-span-full bg-white/5 border border-white/10 p-6 rounded-2xl text-center text-neutral-500">
          Всі кошики були сплачені 😎
        </div>
      )}
    </div>
  );
}
