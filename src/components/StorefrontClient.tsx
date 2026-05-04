'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from './StoreProvider';

function DiscountTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const diff = new Date(expiresAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft('Акція завершилась');
        return;
      }
      const m = Math.floor((diff / 1000 / 60) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    updateTimer();
    const int = setInterval(updateTimer, 1000);
    return () => clearInterval(int);
  }, [expiresAt]);

  return <div className="font-mono text-2xl font-black bg-emerald-500/20 px-4 py-2 rounded-xl text-emerald-400 border border-emerald-500/30">{timeLeft}</div>;
}

export default function StorefrontClient({ products, categories, isForbidden, rouletteSlices = [] }: { products: any[], categories: any[], isForbidden?: boolean, rouletteSlices?: {discount: number, chance: number}[] }) {
  const router = useRouter();
  const { user, token, loading, cart, addToCart, cartTotal, refreshUser } = useStore();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  
  // Forbidden Modal State
  const [showForbidden, setShowForbidden] = useState(!!isForbidden);

  const [mounted, setMounted] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Secret Dev Reset
  const [devTaps, setDevTaps] = useState(0);
  const handleDevTap = () => {
    setDevTaps(p => p + 1);
    if (devTaps + 1 >= 5) {
       localStorage.removeItem('tg_notification_allowed');
       localStorage.removeItem('lastRouletteSpin');
       setDevTaps(0);
       if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
          (window as any).Telegram.WebApp.showAlert('DEV: Таймери скинуто (Підписка, Рулетка)! Оновіть додаток.');
       } else {
          alert('DEV: Таймери скинуто (Підписка, Рулетка)! Оновіть сторінку.');
       }
    }
  };

  useEffect(() => {
    setMounted(true);
    // Optionally clean up the URL so it doesn't persist on refresh
    if (isForbidden) {
      window.history.replaceState(null, '', '/');
    }
  }, [isForbidden]);

  const validCategoryIds = activeCategory === 'all' 
    ? [] 
    : [activeCategory, ...categories.filter(c => c.parentId === activeCategory).map(c => c.id)];

  const baseFilteredCategory = activeCategory === 'all' 
    ? products 
    : activeSubCategory 
      ? products.filter(p => p.categoryId === activeSubCategory)
      : products.filter(p => validCategoryIds.includes(p.categoryId));

  const filteredProducts = baseFilteredCategory.filter(p => {
    if (searchQuery.length < 4) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalCents = cartTotal(products);
  
  const hasActiveDiscount = user?.activeDiscountPercent && user?.discountExpiresAt && new Date(user.discountExpiresAt) > new Date();

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white w-full px-4 md:px-12 lg:px-24 relative overflow-hidden font-sans pb-40 pt-6">
      
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-64 bg-indigo-600/20 blur-[120px] pointer-events-none -z-10" />

      {/* Header Area */}
      <header className="flex justify-between items-center mb-10 w-full max-w-[1600px] mx-auto">
        <div>
          <h1 onClick={handleDevTap} className="cursor-pointer text-3xl lg:text-5xl font-black tracking-tight tracking-wider bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">
            {user?.firstName ? `Привіт, ${user.firstName}` : 'STORE'}
          </h1>
          <p className="text-sm lg:text-base text-neutral-400 mt-1">Telegram DH-3D-Store</p>
        </div>

        {hasActiveDiscount && user.discountExpiresAt && (
           <div className="hidden md:flex flex-col items-center animate-in fade-in zoom-in duration-500">
             <span className="text-xs text-neutral-400 uppercase tracking-widest mb-1">Знижка {user.activeDiscountPercent}% діє ще:</span>
             <DiscountTimer expiresAt={user.discountExpiresAt} />
           </div>
        )}

        <div className="flex items-center gap-3">
          <div className="bg-white/10 border border-white/20 backdrop-blur-md px-5 py-3 rounded-full flex items-center gap-3 shadow-[0_0_20px_rgba(255,215,0,0.15)] hover:scale-105 transition-transform">
            <span className="text-2xl leading-none">🪙</span>
            <span className="font-bold text-yellow-500 text-xl">{user?.coinsBalance || 0}</span>
          </div>

          <button onClick={() => router.push('/checkout')} className="w-14 h-14 bg-white/10 border border-white/20 backdrop-blur-md rounded-full flex items-center justify-center relative hover:scale-105 transition-transform hover:bg-white/20">
            <span className="text-2xl">🛒</span>
            {mounted && cart.length > 0 && (
              <div className="absolute top-0 right-0 w-5 h-5 bg-red-500 animate-pulse rounded-full border-2 border-[#0a0a0a] flex items-center justify-center text-[10px] font-bold text-white">
                {cart.reduce((n, i) => n + i.quantity, 0)}
              </div>
            )}
          </button>
        </div>
      </header>
      
      {hasActiveDiscount && user.discountExpiresAt && (
           <div className="flex md:hidden flex-col items-start mb-8 animate-in fade-in zoom-in duration-500">
             <span className="text-xs text-neutral-400 uppercase tracking-widest mb-1">Знижка {user.activeDiscountPercent}% діє ще:</span>
             <DiscountTimer expiresAt={user.discountExpiresAt} />
           </div>
      )}

      {/* Storefront Search */}
      <section className="mb-6 w-full max-w-[1600px] mx-auto animate-in fade-in duration-500">
         <input 
            type="text" 
            placeholder="Пошук товарів (назва, артикул, опис)..." 
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500 hover:border-white/20 transition-colors shadow-lg placeholder-neutral-500" 
         />
      </section>

      {/* Categories Horizontal Scroll / Wrap */}
      <section className="mb-10 w-full overflow-hidden">
        {/* Parent Level */}
        <div className="flex gap-4 flex-wrap pb-4 w-full">
          <button onClick={() => { setActiveCategory('all'); setActiveSubCategory(null); }} className={`whitespace-nowrap px-6 py-3 rounded-2xl text-base font-bold transition-all ${activeCategory === 'all' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 -translate-y-1' : 'bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'}`}>Всі Каталоги</button>
          {categories.filter(c => !c.parentId).map(cat => (
            <button 
              key={cat.id} 
              onClick={() => { setActiveCategory(cat.id); setActiveSubCategory(null); }}
              className={`whitespace-nowrap px-6 py-3 rounded-2xl text-base font-bold transition-all ${activeCategory === cat.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 -translate-y-1' : 'bg-white/5 border border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Subcategory Level (if active parent has children) */}
        {activeCategory !== 'all' && categories.filter(c => c.parentId === activeCategory).length > 0 && (
          <div className="flex gap-3 flex-wrap pt-2 w-full animate-in fade-in slide-in-from-top-2 border-t border-white/5 mt-2">
             <button 
               onClick={() => setActiveSubCategory(null)}
               className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${!activeSubCategory ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 border border-white/5 text-neutral-500 hover:text-white'}`}
             >
               Всі товари '{categories.find(c => c.id === activeCategory)?.name}'
             </button>
             {categories.filter(c => c.parentId === activeCategory).map(subCat => (
               <button 
                 key={subCat.id} 
                 onClick={() => setActiveSubCategory(subCat.id)}
                 className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeSubCategory === subCat.id ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 border border-white/5 text-neutral-500 hover:text-white'}`}
               >
                 {subCat.name}
               </button>
             ))}
          </div>
        )}
      </section>

      {/* Products Grid (Fully Fluid) */}
      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 md:gap-6 lg:gap-8 max-w-[1600px] mx-auto">
        {paginatedProducts.map(p => (
          <div 
            key={p.id} 
            onClick={() => window.location.href = `/product/${p.id}`}
            className="bg-[#151515] border border-white/5 shadow-2xl rounded-3xl p-5 flex flex-col group cursor-pointer transition-all hover:bg-[#1a1a1a] hover:-translate-y-2 hover:border-white/10 flex-grow"
          >
            <div className="w-full aspect-square bg-gradient-to-br from-[#111] to-[#0a0a0a] rounded-2xl mb-5 flex items-center justify-center relative overflow-hidden">
               {p.images && p.images.length > 0 ? (
                 <img src={`/api/file?path=${p.images[0]}`} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
               ) : (
                 <span className="text-8xl drop-shadow-xl group-hover:scale-110 transition-transform duration-500">📦</span>
               )}
            </div>
            <h3 className="text-lg font-bold line-clamp-2 mb-3 leading-tight min-h-[50px] text-neutral-200">{p.name}</h3>
            <div className="flex justify-between items-end mt-auto pt-4 border-t border-white/5">
              <div className="flex flex-col">
                {hasActiveDiscount && <div className="text-sm text-neutral-500 line-through mb-1">{(p.price / 100).toFixed(2)} ₴</div>}
                <span className={`font-black text-xl tracking-tight ${hasActiveDiscount ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'text-neutral-100'}`}>
                  {hasActiveDiscount ? ((p.price * (1 - user.activeDiscountPercent! / 100)) / 100).toFixed(2) : (p.price / 100).toFixed(2)} ₴
                </span>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  addToCart(p.id);
                }}
                className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-indigo-500 hover:text-white flex items-center justify-center border border-white/10 active:scale-90 transition-all text-neutral-400 group-hover:bg-indigo-500 group-hover:text-white shadow-xl"
              >
                <span className="text-2xl font-bold leading-none translate-y-[-1px]">＋</span>
              </button>
            </div>
          </div>
        ))}
        {paginatedProducts.length === 0 && <div className="col-span-full py-32 text-center text-xl text-neutral-500 font-medium bg-white/5 rounded-3xl border border-white/5">Товарів в цій категорії ще немає</div>}
      </section>

      {/* Storefront Paginator */}
      {totalPages > 1 && (
         <div className="flex justify-center items-center mt-12 mb-10 gap-2 md:gap-4 max-w-[1600px] mx-auto">
           <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 md:px-6 py-2 bg-white/5 rounded-xl font-bold hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition border border-white/10">Попередня</button>
           
           <div className="flex border border-white/10 rounded-xl bg-white/5 overflow-hidden text-sm">
              <button onClick={() => {setItemsPerPage(25); setCurrentPage(1);}} className={`px-4 py-2 ${itemsPerPage === 25 ? 'bg-indigo-500 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}>25</button>
              <button onClick={() => {setItemsPerPage(50); setCurrentPage(1);}} className={`px-4 py-2 border-l border-white/10 ${itemsPerPage === 50 ? 'bg-indigo-500 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}>50</button>
              <button onClick={() => {setItemsPerPage(100); setCurrentPage(1);}} className={`px-4 py-2 border-l border-white/10 ${itemsPerPage === 100 ? 'bg-indigo-500 text-white font-bold' : 'text-neutral-400 hover:text-white'}`}>100</button>
           </div>
           
           <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 md:px-6 py-2 bg-white/5 rounded-xl font-bold hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition border border-white/10">Наступна</button>
         </div>
      )}

      {/* Floating Checkout Button */}
      {mounted && cart.length > 0 && (
        <div className="fixed bottom-8 left-0 right-0 px-4 md:px-12 flex justify-center z-40 animate-in slide-in-from-bottom-5">
           <div className="bg-neutral-900/90 backdrop-blur-2xl border border-white/10 px-8 py-5 rounded-3xl w-full max-w-4xl flex items-center justify-between shadow-[0_20px_60px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
             <div className="flex items-center gap-6">
               <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                 <span className="text-2xl">🛒</span>
               </div>
               <div>
                 <p className="text-sm text-neutral-400 font-medium mb-1">В кошику ({cart.reduce((n,i)=>n+i.quantity,0)} товарів)</p>
                 <p className="font-black text-2xl text-emerald-400">
                    <span className="flex items-center gap-2">
                      {hasActiveDiscount && <span className="text-sm line-through text-neutral-500 font-normal">{(totalCents / 100).toFixed(2)}</span>}
                      <span>{( (hasActiveDiscount ? totalCents * (1 - user.activeDiscountPercent! / 100) : totalCents) / 100).toFixed(2)} ₴</span>
                    </span>
                 </p>
               </div>
             </div>
             <button onClick={() => {
                 router.push('/checkout');
             }} className="bg-white text-black px-8 py-4 rounded-2xl font-black text-lg active:scale-95 transition-transform flex items-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-neutral-200">
               Оплатити <span className="text-2xl leading-none opacity-50 translate-y-[-1px]">→</span>
             </button>
           </div>
        </div>
      )}

      {/* FORBIDDEN ACCESS MODAL */}
      {showForbidden && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-[#111] border border-red-500/30 rounded-[30px] p-8 text-center shadow-[0_0_50px_rgba(239,68,68,0.2)] relative overflow-hidden animate-in zoom-in-75 duration-300">
              <div className="text-5xl mb-4">🚫</div>
              <h2 className="text-2xl font-black mb-2 text-white">Доступ Заборонено</h2>
              <p className="text-neutral-400 mb-8 text-sm">У вас немає прав для доступу до цієї частини адмін-панелі. Вас було автоматично перенаправлено до магазину.</p>
              
              <button 
                onClick={() => setShowForbidden(false)} 
                className="w-full bg-neutral-800 text-white border border-white/10 rounded-xl py-3 font-bold active:scale-95 transition-transform hover:bg-neutral-700"
              >
                Зрозуміло
              </button>
           </div>
        </div>
      )}
      
    </main>
  );
}
