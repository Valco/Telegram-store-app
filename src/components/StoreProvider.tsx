'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GlobalRoulette from './GlobalRoulette';

type UserData = {
  id: string;
  telegramId: string;
  firstName: string;
  coinsBalance: number;
  activeDiscountPercent?: number;
  discountExpiresAt?: string;
  lastName?: string;
  phone?: string;
  hasRecentSpin?: boolean;
};

type StoreContextType = {
  user: UserData | null;
  token: string | null;
  loading: boolean;
  cart: { productId: string; quantity: number }[];
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  cartTotal: (productsBase: any[]) => number;
  refreshUser: () => void;
};

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tg_cart');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });

  const fetchAuth = async () => {
    try {
      let initData = '';
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
        initData = (window as any).Telegram.WebApp.initData;
      }

      // Check if we are in a normal browser
      if (!initData && typeof window !== 'undefined') {
        let guestId = localStorage.getItem('tg_store_web_guest');
        if (!guestId) {
          guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('tg_store_web_guest', guestId);
        }
        initData = `WEB_GUEST:${guestId}`;
      }

      if (!initData) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify({ initData })
      });
      const data = await res.json();
      
      if (data.success) {
        setToken(data.token);
        setUser(data.user);
      }
    } catch (e) {
      console.error('Failed Telegram init', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuth();
    
    // Process deep link (startapp) parameters ONCE per session to prevent infinite redirect loops
    if (typeof window !== 'undefined') {
      const handled = sessionStorage.getItem('tg_deeplink_handled');
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam && !handled) {
          sessionStorage.setItem('tg_deeplink_handled', 'true');
          router.push(`/product/${startParam}`);
        }
      }
    }
  }, [router]);

  useEffect(() => {
    localStorage.setItem('tg_cart', JSON.stringify(cart));
    
    // Sync abandoned cart with backend
    if (token) {
      fetch('/api/cart/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cart })
      }).catch(e => console.error('Cart sync failed', e));
    }
  }, [cart, token]);

  useEffect(() => {
    if (typeof window !== 'undefined' && cart.length > 0) {
      const hasAllowedStatus = localStorage.getItem('tg_notification_allowed');
      let shouldShow = false;

      if (!hasAllowedStatus) {
         shouldShow = true;
      } else if (hasAllowedStatus !== 'true') {
         const lastDeclinedAt = parseInt(hasAllowedStatus, 10);
         if (!isNaN(lastDeclinedAt) && Date.now() - lastDeclinedAt > 24 * 60 * 60 * 1000) {
            shouldShow = true;
         }
      }

      if (shouldShow) {
         setShowSubscribeModal(true);
      }
    }
  }, [cart.length]);

  const addToCart = (productId: string) => {
    setCart(prev => {
      const exists = prev.find(p => p.productId === productId);
      if (exists) {
        return prev.map(p => p.productId === productId ? { ...p, quantity: p.quantity + 1 } : p);
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(p => p.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCart(prev => 
      prev.map(p => p.productId === productId ? { ...p, quantity: Math.max(1, quantity) } : p)
    );
  };

  const cartTotal = (productsBase: any[]) => {
    let totalCents = 0;
    cart.forEach(item => {
      const p = productsBase.find(x => x.id === item.productId);
      if (p) totalCents += p.price * item.quantity;
    });

    // Apply active discount if valid
    if (user?.activeDiscountPercent && user?.discountExpiresAt) {
      if (new Date(user.discountExpiresAt) > new Date()) {
        totalCents = totalCents * (1 - user.activeDiscountPercent / 100);
      }
    }
    return totalCents;
  };

  const handleAllowNotifications = () => {
     localStorage.setItem('tg_notification_allowed', 'true');
     setShowSubscribeModal(false);
     
     const tg = typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : null;
     
     if (tg && tg.requestWriteAccess) {
        tg.requestWriteAccess((granted: boolean) => {
           if (!granted) {
              console.log('User declined write access via Telegram popup');
           }
        });
     } else if (tg && tg.openTelegramLink) {
        const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'telstoredh3d_bot';
        tg.openTelegramLink(`https://t.me/${botUsername}?start=subscribe`);
     } else {
        const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'telstoredh3d_bot';
        window.open(`https://t.me/${botUsername}?start=subscribe`, '_blank');
     }
  };

  const handleDeclineNotifications = () => {
     localStorage.setItem('tg_notification_allowed', Date.now().toString()); // Save timestamp to ask again in 24h
     setShowSubscribeModal(false);
  };

  return (
    <StoreContext.Provider value={{ user, token, loading, cart, addToCart, removeFromCart, updateQuantity, cartTotal, refreshUser: fetchAuth }}>
      {children}
      <GlobalRoulette />

      {showSubscribeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300 pointer-events-auto">
           <div className="w-full max-w-sm bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] border border-indigo-500/30 rounded-[30px] p-6 text-center shadow-[0_0_50px_rgba(99,102,241,0.2)] relative overflow-hidden animate-in zoom-in-75 duration-300 slide-in-from-bottom-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-indigo-500/20 blur-[50px] rounded-full pointer-events-none" />
              
              <div className="text-5xl mb-4 relative z-10 flex justify-center drop-shadow-xl">
                 <span className="bg-indigo-500/20 w-20 h-20 flex items-center justify-center rounded-2xl border border-indigo-500/40 animate-bounce">
                    🔔
                 </span>
              </div>
              <h2 className="text-2xl font-black mb-2 text-white relative z-10">Дозволити сповіщення?</h2>
              <p className="text-neutral-300 mb-8 text-sm leading-relaxed relative z-10 px-2">
                Щоб ви могли отримувати інформацію про <b>статус ваших замовлень</b> та <b>покинутий кошик</b>, нам потрібен ваш дозвіл на відправку повідомлень в Telegram.
              </p>
              
              <div className="flex flex-col gap-3 relative z-10">
                <button 
                  onClick={handleAllowNotifications} 
                  className="w-full bg-indigo-500 text-white rounded-2xl py-4 font-black shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95 transition-transform hover:bg-indigo-400 text-lg flex items-center justify-center gap-2"
                >
                  ✅ Дозволити сповіщення
                </button>
                <button 
                  onClick={handleDeclineNotifications} 
                  className="w-full bg-transparent text-neutral-500 rounded-2xl py-3 font-bold active:scale-95 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Не зараз
                </button>
              </div>
           </div>
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be inside StoreProvider');
  return context;
}
