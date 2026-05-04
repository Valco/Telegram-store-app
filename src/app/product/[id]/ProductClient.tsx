'use client';

import { useStore } from '@/components/StoreProvider';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ProductClient({ product }: { product: any }) {
  const { user, addToCart } = useStore();
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const hasActiveDiscount = user?.activeDiscountPercent && user?.discountExpiresAt && new Date(user.discountExpiresAt) > new Date();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white w-full px-4 md:px-12 lg:px-24">
       <header className="flex items-center gap-4 mb-6 pt-6">
         <button onClick={() => router.push('/')} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center font-bold active:scale-95 transition-transform hover:bg-white/20">
           ←
         </button>
         <h1 className="text-2xl font-black truncate">{product.name}</h1>
       </header>

       <div className="flex flex-col md:flex-row gap-8 pb-28">
         
         {/* Product Media Slider */}
         <div className="w-full md:w-1/2 aspect-square bg-gradient-to-br from-[#111] to-[#0a0a0a] rounded-3xl border border-white/5 shadow-2xl relative overflow-hidden group">
            {product.images && product.images.length > 0 ? (
               <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                 {product.images.map((img: string, idx: number) => (
                   <div key={idx} className="w-full h-full flex-shrink-0 snap-center flex items-center justify-center relative">
                     <img 
                       src={`/api/file?path=${img}`} 
                       alt={`${product.name} - ${idx + 1}`} 
                       onClick={() => setLightboxIndex(idx)}
                       className="w-full h-full object-contain p-4 cursor-pointer transition-transform duration-500 hover:scale-105" 
                     />
                     {product.images.length > 1 && (
                       <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white/80 border border-white/10 pointer-events-none z-10">
                         {idx + 1} / {product.images.length}
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            ) : (
               <div className="w-full h-full flex items-center justify-center">
                 <span className="text-[150px] drop-shadow-xl group-hover:scale-110 transition-transform duration-500">📦</span>
               </div>
            )}
         </div>

         {/* Product Details */}
         <div className="flex-1 flex flex-col pt-4">
            <div className="text-sm text-indigo-400 font-bold tracking-widest uppercase mb-2">
              {product.category?.name || 'Без Категорії'}
            </div>
            
            <h2 className="text-3xl md:text-5xl font-black mb-4 leading-tight">{product.name}</h2>
            
            <div className="flex items-end gap-3 mb-4">
              <div className="flex flex-col">
                {hasActiveDiscount && <div className="text-sm text-neutral-500 line-through mb-1">{(product.price / 100).toFixed(2)} ₴</div>}
                <span className={`font-black text-4xl tracking-tight ${hasActiveDiscount ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'text-neutral-100'}`}>
                  {hasActiveDiscount ? ((product.price * (1 - user.activeDiscountPercent! / 100)) / 100).toFixed(2) : (product.price / 100).toFixed(2)} ₴
                </span>
              </div>
            </div>

            {product.status === 'MADE_TO_ORDER' && (
              <div className="text-emerald-400 font-bold mb-8">
                ⏳ Виготовляється під замовлення {product.madeToOrderDays ? `(${product.madeToOrderDays} дн.)` : ''}
              </div>
            )}
            {product.status !== 'MADE_TO_ORDER' && <div className="mb-8" />}

            <p className="text-neutral-400 text-lg leading-relaxed mb-10 whitespace-pre-line">
              {product.description || 'Опис відсутній. Це чудовий товар, який обов\'язково вам сподобається!'}
            </p>
            
            {/* Characteristics block... add later if robust schema is implemented for spec sheets */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="mb-10">
                <h3 className="text-sm font-bold text-neutral-500 uppercase mb-3">Опції / Розміри:</h3>
                <div className="flex gap-2 flex-wrap">
                  {product.sizes.map((s: string) => (
                    <div key={s} className="px-4 py-2 border border-white/10 rounded-xl bg-white/5 cursor-not-allowed opacity-50">
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => {
                addToCart(product.id);
                router.push('/checkout');
              }} 
              className="mt-auto w-full bg-indigo-500 text-white px-8 py-5 rounded-2xl font-black text-xl hover:bg-white hover:text-black shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] active:scale-95 transition-all text-center flex items-center justify-center gap-3 group"
            >
              Додати в кошик 
              <span className="opacity-70 group-hover:opacity-100 transition-opacity">🛒</span>
            </button>
         </div>
       </div>

       {/* Fullscreen Lightbox Popup */}
       {lightboxIndex !== null && product.images && (
         <div 
           className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in"
         >
           <button 
             onClick={() => setLightboxIndex(null)}
             className="absolute top-6 right-6 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white font-bold text-xl hover:bg-white/20 transition-colors z-[60]"
           >
             ✖
           </button>
           
           {product.images.length > 1 && (
             <button 
               onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev! > 0 ? prev! - 1 : product.images.length - 1); }}
               className="absolute left-4 md:left-10 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white font-bold hover:bg-white/20 transition-colors z-[60]"
             >
               ←
             </button>
           )}

           <img 
             src={`/api/file?path=${product.images[lightboxIndex]}`} 
             alt="Enlarged product" 
             className="max-w-full max-h-[90vh] object-contain drop-shadow-[0_0_50px_rgba(255,255,255,0.1)] scale-in-center"
           />

           {product.images.length > 1 && (
             <button 
               onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => prev! < product.images.length - 1 ? prev! + 1 : 0); }}
               className="absolute right-4 md:right-10 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white font-bold hover:bg-white/20 transition-colors z-[60]"
             >
               →
             </button>
           )}
           
           {product.images.length > 1 && (
             <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm tracking-widest font-mono z-[60]">
               {lightboxIndex + 1} / {product.images.length}
             </div>
           )}
         </div>
       )}
    </main>
  );
}
