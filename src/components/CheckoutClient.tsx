'use client';

import { useState, useEffect } from 'react';
import { useStore } from './StoreProvider';
import Link from 'next/link';

export default function CheckoutClient({ products, settings }: { products: any[], settings: any }) {
  const { user, token, cart, updateQuantity, removeFromCart } = useStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);
  
  // Choose either 'roulette' discount or 'coins'
  const [discountType, setDiscountType] = useState<'roulette' | 'coins'>('roulette');

  // Custom coin input state
  const [customCoins, setCustomCoins] = useState('');

  const [details, setDetails] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    city: '',
    cityRef: '',
    branch: '',
    branchRef: '',
    phone: user?.phone || '',
    comment: '',
    doNotCall: false,
    deliveryMethod: 'nova_poshta',
    paymentMethod: 'monobank'
  });

  const [phoneError, setPhoneError] = useState('');

  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [branchQuery, setBranchQuery] = useState('');
  const [branchResults, setBranchResults] = useState<any[]>([]);
  const [isSearchingBranch, setIsSearchingBranch] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  // Phone Formatter
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    let digits = value.replace(/\D/g, '');
    
    // Auto-detect starting patterns and normalize to 380...
    if (digits.length > 0) {
      if (digits.startsWith('38')) {
        // do nothing, already has 38
      } else if (digits.startsWith('0')) {
        digits = '38' + digits; // prepend 38 to 0XX
      } else if (digits.startsWith('8')) {
        digits = '3' + digits;
      } else {
        // if user types 9, pretend it's +38 09...
        digits = '380' + digits;
      }
    }

    // Limit to 12 digits (38 0XX XXX XX XX)
    digits = digits.slice(0, 12);

    // Format string: +38 099 123 45 67
    let formatted = '';
    if (digits.length > 0) formatted += '+' + digits.substring(0, 2); // +38
    if (digits.length > 2) formatted += ' ' + digits.substring(2, 5); // 099
    if (digits.length > 5) formatted += ' ' + digits.substring(5, 8); // 123
    if (digits.length > 8) formatted += ' ' + digits.substring(8, 10); // 45
    if (digits.length > 10) formatted += ' ' + digits.substring(10, 12); // 67
    
    return formatted.trim();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Nova Poshta API City Integration
  useEffect(() => {
    if (cityQuery.length < 2) {
      setCityResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingCity(true);
      try {
        const res = await fetch('/api/np/cities', { method: 'POST', body: JSON.stringify({ query: cityQuery }) });
        const data = await res.json();
        if (data.success) setCityResults(data.data);
      } catch (e) {}
      setIsSearchingCity(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [cityQuery]);

  // Nova Poshta API Branch Integration
  useEffect(() => {
    if (!details.cityRef) return;
    const timer = setTimeout(async () => {
      setIsSearchingBranch(true);
      try {
        const res = await fetch('/api/np/branches', { method: 'POST', body: JSON.stringify({ cityRef: details.cityRef, query: branchQuery }) });
        const data = await res.json();
        if (data.success) setBranchResults(data.data);
      } catch (e) {}
      setIsSearchingBranch(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [branchQuery, details.cityRef]);

  // Calculation
  let subtotalCents = 0;
  cart.forEach(item => {
    const p = products.find(x => x.id === item.productId);
    if (p) subtotalCents += p.price * item.quantity;
  });

  const hasActiveDiscount = user?.activeDiscountPercent && user?.discountExpiresAt && new Date(user.discountExpiresAt) > new Date();

  // Coin logic
  const maxUahDiscount = (subtotalCents / 100) * (settings.maxCoinsPercent / 100);
  const maxCoinsAllowed = Math.floor(maxUahDiscount * settings.coinToUahRate);
  const maxCoinsTheyHave = Math.min(user?.coinsBalance || 0, maxCoinsAllowed);
  
  const coinsInputVal = customCoins === '' ? maxCoinsTheyHave : Math.max(0, parseInt(customCoins) || 0);
  const coinsToUse = Math.min(coinsInputVal, maxCoinsTheyHave);
  const coinDiscountCents = Math.floor(coinsToUse / settings.coinToUahRate) * 100;

  // Final Total resolution
  let finalTotalCents = subtotalCents;
  if (discountType === 'roulette' && hasActiveDiscount) {
    finalTotalCents = subtotalCents * (1 - (user.activeDiscountPercent || 0) / 100);
  } else if (discountType === 'coins' && coinsToUse > 0) {
    finalTotalCents = Math.max(0, subtotalCents - coinDiscountCents);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return alert('Помилка авторизації');

    // Phone validation: must have exactly 12 digits (+38 0XX XXX XX XX)
    const phoneDigits = details.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 12) {
      setPhoneError('Введіть повний номер телефону у форматі +38 0XX XXX XX XX');
      return;
    }
    setPhoneError('');
    
    setLoading(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ cart, details, discountType, coinsToUse: coinsToUse.toString() })
      });
      const data = await res.json();
      if (data.success) {
        if (data.paymentUrl && data.paymentUrl.startsWith('http')) {
           // @ts-ignore
           if (window.Telegram?.WebApp && window.Telegram.WebApp.initData) {
             // Відкриваємо посилання на оплату в зовнішньому браузері Telegram
             // @ts-ignore
             window.Telegram.WebApp.openLink(data.paymentUrl);
             // Перенаправляємо сам Mini App на сторінку успіху, щоб після закриття оплати клієнт бачив результат
             window.location.href = `/success?orderId=${data.orderId}`;
           } else {
             // Звичайний браузер: просто переходимо на Monobank
             window.location.href = data.paymentUrl;
           }
           return;
        }
        // Redirect to success page for postpaid
        window.location.href = `/success?orderId=${data.orderId}`;
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Помилка під час оформлення');
    }
    setLoading(false);
  };

  if (!mounted) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white w-full px-4 md:px-12 lg:px-24 py-32 flex justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-white p-4 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-2xl font-black mb-2">Замовлення Оформлено</h2>
        <p className="text-neutral-400 mb-8">{success}</p>
        <Link href="/" className="bg-indigo-500 px-8 py-3 rounded-2xl font-bold active:scale-95 transition-transform">
          Повернутись до покупок
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white w-full px-4 md:px-12 lg:px-24">
       <header className="flex items-center gap-4 mb-6 pt-2">
         <Link href="/" className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center font-bold active:scale-95 transition-transform hover:bg-white/20">
           ←
         </Link>
         <h1 className="text-2xl font-black">Оформлення Замовлення</h1>
       </header>

       {cart.length === 0 ? (
         <div className="text-center py-32">
           <p className="text-neutral-500 text-lg">Кошик порожній</p>
         </div>
       ) : (
         <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-28">
           
           {/* Section 1: Cart Items */}
           <div className="bg-white/5 border border-white/10 p-6 rounded-3xl h-fit">
             <h2 className="font-bold text-xl mb-4 text-emerald-400">Ваше Замовлення</h2>
             <div className="space-y-4 mb-6">
               {cart.map((item, i) => {
                 const p = products.find((x: any) => x.id === item.productId);
                 if (!p) return null;
                 const itemSubtotal = p.price * item.quantity;
                 let itemFinalTotal = itemSubtotal;
                 if (discountType === 'roulette' && hasActiveDiscount) {
                    itemFinalTotal = itemSubtotal * (1 - (user.activeDiscountPercent || 0) / 100);
                 }
                 
                 return (
                   <div key={i} className="flex flex-col gap-2 border-b border-white/5 pb-4 last:border-0 last:pb-0">
                     <div className="flex justify-between items-start">
                       <Link href={`/product/${p.id}`} className="text-neutral-300 font-medium hover:text-indigo-400 transition-colors line-clamp-2 pr-4">{p.name}</Link>
                       <button 
                         type="button"
                         onClick={() => removeFromCart(p.id)}
                         className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors flex-shrink-0"
                       >
                         🗑️
                       </button>
                     </div>
                     
                     <div className="flex justify-between items-center mt-2">
                       <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl p-1">
                         <button type="button" onClick={() => updateQuantity(p.id, item.quantity - 1)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold text-neutral-400 active:scale-90">-</button>
                         <span className="font-mono w-4 text-center text-sm">{item.quantity}</span>
                         <button type="button" onClick={() => updateQuantity(p.id, item.quantity + 1)} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center font-bold text-neutral-400 active:scale-90">+</button>
                       </div>
                       <div className="flex flex-col items-end">
                         {itemFinalTotal !== itemSubtotal && (
                           <span className="font-mono text-xs text-neutral-500 line-through">{(itemSubtotal / 100).toFixed(2)} ₴</span>
                         )}
                         <span className="font-mono text-lg font-bold">{(itemFinalTotal / 100).toFixed(2)} ₴</span>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
             
             {/* Discount Type Selection */}
             {(hasActiveDiscount || (user?.coinsBalance && user.coinsBalance > 0)) && (
               <div className="pt-2 pb-4">
                 <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-3">Використати бонуси:</h3>
                 <div className="space-y-2">
                   {hasActiveDiscount && (
                     <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${discountType === 'roulette' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/30 border-white/5 hover:bg-white/5'}`}>
                       <div className="flex items-center gap-3">
                         <input type="radio" name="discountType" value="roulette" checked={discountType === 'roulette'} onChange={() => setDiscountType('roulette')} className="accent-emerald-500 w-4 h-4" />
                         <span>Купон Знижки <span className="font-bold text-emerald-400">(-{user.activeDiscountPercent}%)</span></span>
                       </div>
                     </label>
                   )}
                   {user?.coinsBalance && user.coinsBalance > 0 ? (
                     <div className={`p-3 rounded-xl border transition-all ${discountType === 'coins' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-black/30 border-white/5 hover:bg-white/5'}`}>
                       <label className="flex items-center justify-between cursor-pointer w-full">
                         <div className="flex items-center gap-3">
                           <input type="radio" name="discountType" value="coins" checked={discountType === 'coins'} onChange={() => setDiscountType('coins')} className="accent-yellow-500 w-4 h-4" />
                           <div className="flex flex-col">
                             <span className="font-bold">Оплата Монетами 🪙</span>
                             <span className="text-yellow-500 font-bold text-sm mt-1">{settings.coinToUahRate} монет = 1 грн</span>
                           </div>
                         </div>
                         <span className="text-sm text-neutral-400 whitespace-nowrap overflow-hidden text-ellipsis ml-2">(макс {settings.maxCoinsPercent}%)</span>
                       </label>
                       {discountType === 'coins' && (
                         <div className="mt-3 ml-7 flex flex-col gap-1">
                           <span className="text-xs text-neutral-400">Скільки монет списати? (Доступно: {user.coinsBalance}, Максимум для списування: {maxCoinsTheyHave})</span>
                           <input 
                             type="number" 
                             max={maxCoinsTheyHave}
                             value={customCoins} 
                             onChange={e => setCustomCoins(e.target.value)}
                             placeholder={`Введіть від 0 до ${maxCoinsTheyHave}`}
                             className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-yellow-500 focus:outline-none focus:border-yellow-500 w-[250px]"
                           />
                         </div>
                       )}
                     </div>
                   ) : null}
                 </div>
               </div>
             )}

             {/* Subtotal & Final Calculation UI */}
             <div className="pt-4 border-t border-white/10 flex flex-col gap-2 text-lg">
               <div className="flex justify-between items-center text-neutral-400">
                 <span>Сума:</span>
                 <span>{(subtotalCents / 100).toFixed(2)} ₴</span>
               </div>
               
               {discountType === 'roulette' && hasActiveDiscount && (
                 <div className="flex justify-between items-center text-emerald-400 font-bold">
                   <span>Знижка (-{user.activeDiscountPercent}%):</span>
                   <span>-{((subtotalCents - finalTotalCents) / 100).toFixed(2)} ₴</span>
                 </div>
               )}
               
               {discountType === 'coins' && coinsToUse > 0 && (
                 <div className="flex justify-between items-center text-yellow-500 font-bold">
                   <span>Монети (-{coinsToUse} 🪙):</span>
                   <span>-{(coinDiscountCents / 100).toFixed(2)} ₴</span>
                 </div>
               )}
               
               <div className="pt-2 border-t border-white/10 flex justify-between items-center text-xl mt-2">
                 <span className="font-bold">До оплати:</span>
                 <span className="font-black text-emerald-400">{(finalTotalCents / 100).toFixed(2)} ₴</span>
               </div>
             </div>
           </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
              <h2 className="font-bold">Оплата</h2>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${details.paymentMethod === 'monobank' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-black/30 border-white/5 hover:bg-white/5'}`}>
                  <input type="radio" name="paymentMethod" value="monobank" checked={details.paymentMethod === 'monobank'} onChange={e => setDetails({...details, paymentMethod: e.target.value})} className="accent-indigo-500 w-4 h-4" />
                  <div className="flex flex-col">
                    <span className="font-bold">Онлайн Оплата (Monobank / Apple Pay / Картка)</span>
                    <span className="text-xs text-neutral-400">Безпечна оплата будь-якою карткою або гаманцем</span>
                  </div>
                </label>
                
                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${details.paymentMethod === 'postpaid' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-black/30 border-white/5 hover:bg-white/5'}`}>
                  <input type="radio" name="paymentMethod" value="postpaid" checked={details.paymentMethod === 'postpaid'} onChange={e => setDetails({...details, paymentMethod: e.target.value})} className="accent-indigo-500 w-4 h-4" />
                  <div className="flex flex-col">
                    <span className="font-bold">При отриманні</span>
                    <span className="text-xs text-neutral-400">Оплата на відділенні Нової Пошти (післяплатою)</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-4">
              <h2 className="font-bold">Доставка</h2>
              <div className="space-y-2 mb-6">
                <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${details.deliveryMethod === 'nova_poshta' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/30 border-white/5 hover:bg-white/5'}`}>
                  <input type="radio" name="deliveryMethod" value="nova_poshta" checked={details.deliveryMethod === 'nova_poshta'} onChange={e => setDetails({...details, deliveryMethod: e.target.value})} className="accent-emerald-500 w-4 h-4" />
                  <div className="flex flex-col">
                    <span className="font-bold">Нова Пошта (по Україні)</span>
                    <span className="text-xs text-neutral-400">Доставка на відділення або поштомат</span>
                  </div>
                </label>
                {settings.enablePickup !== false && (
                 <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${details.deliveryMethod === 'pickup_cherkasy' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-black/30 border-white/5 hover:bg-white/5'}`}>
                   <input type="radio" name="deliveryMethod" value="pickup_cherkasy" checked={details.deliveryMethod === 'pickup_cherkasy'} onChange={e => {
                     setDetails({...details, deliveryMethod: e.target.value, city: '', cityRef: '', branch: '', branchRef: ''});
                     setCityQuery('');
                     setBranchQuery('');
                   }} className="accent-emerald-500 w-4 h-4" />
                   <div className="flex flex-col">
                     <span className="font-bold">Самовивіз</span>
                     <span className="text-xs text-neutral-400">{settings.pickupAddress || 'Адреса уточнюється'}</span>
                   </div>
                 </label>
                 )}
              </div>

              <h2 className="font-bold">Дані Отримувача</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Ім'я</label>
                  <input value={details.firstName} onChange={e => setDetails({...details, firstName: e.target.value})} required placeholder="Введіть ім'я..." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Прізвище</label>
                  <input value={details.lastName} onChange={e => setDetails({...details, lastName: e.target.value})} required placeholder="Введіть прізвище..." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-500 mb-1">Телефон</label>
                <input 
                  value={details.phone} 
                  onChange={e => {
                    setDetails({...details, phone: formatPhoneNumber(e.target.value)});
                    if (phoneError) setPhoneError('');
                  }} 
                  type="text" 
                  required 
                  placeholder="+38 0XX XXX XX XX" 
                  className={`w-full bg-black/50 border rounded-xl px-4 py-3 outline-none transition-colors ${phoneError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-indigo-500'}`}
                />
                {phoneError && <p className="text-red-400 text-xs mt-1">{phoneError}</p>}
              </div>

              <div className="relative">
                {details.deliveryMethod === 'nova_poshta' && (
                  <>
                    <label className="block text-xs text-neutral-500 mb-1">Місто (Нова Пошта)</label>
                    <div className="relative">
                      <input 
                        value={cityQuery} 
                        onChange={e => {
                          setCityQuery(e.target.value);
                          setShowCityDropdown(true);
                          setDetails(prev => ({ ...prev, city: '', cityRef: '', branch: '', branchRef: '' }));
                        }}
                        required={details.deliveryMethod === 'nova_poshta'}
                        placeholder="Населений пункт..." 
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" 
                      />
                      {isSearchingCity && <div className="absolute right-3 top-3 w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                    
                    {showCityDropdown && cityResults.length > 0 && (
                      <ul className="absolute z-50 mt-1 w-full bg-[#111] border border-white/10 rounded-xl max-h-60 overflow-auto shadow-2xl py-2">
                        {cityResults.map((c: any) => (
                          <li 
                            key={c.ref} 
                            onClick={() => {
                              setCityQuery(`${c.type} ${c.name} (${c.area})`);
                              setDetails(prev => ({ ...prev, city: `${c.type} ${c.name} (${c.area})`, cityRef: c.ref, branch: '', branchRef: '' }));
                              setBranchQuery('');
                              setShowCityDropdown(false);
                            }}
                            className="px-4 py-2 hover:bg-white/5 cursor-pointer text-sm"
                          >
                            <span className="text-neutral-400 mr-2">{c.type}</span>
                            <span className="font-bold text-white">{c.name}</span>
                            <div className="text-xs text-neutral-600">{c.area}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>

              {details.deliveryMethod === 'nova_poshta' && details.cityRef && (
                <div className="relative">
                  <label className="block text-xs text-neutral-500 mb-1">Відділення / Поштомат</label>
                  <div className="relative">
                    <input 
                      value={branchQuery} 
                      onChange={e => {
                        setBranchQuery(e.target.value);
                        setShowBranchDropdown(true);
                        setDetails(prev => ({ ...prev, branch: '', branchRef: '' }));
                      }}
                      required={details.deliveryMethod === 'nova_poshta'}
                      placeholder="Шукати відділення (напр. '32' або 'Поштомат')..." 
                      onFocus={() => setShowBranchDropdown(true)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" 
                    />
                    {isSearchingBranch && <div className="absolute right-3 top-3 w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>}
                  </div>
                  
                  {showBranchDropdown && branchResults.length > 0 && (
                    <ul className="absolute z-50 mt-1 w-full bg-[#111] border border-white/10 rounded-xl max-h-60 overflow-auto shadow-2xl py-2">
                      {branchResults.map((b: any) => (
                        <li 
                          key={b.ref} 
                          onClick={() => {
                            setBranchQuery(b.name);
                            setDetails(prev => ({ ...prev, branch: b.name, branchRef: b.ref }));
                            setShowBranchDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-white/5 cursor-pointer text-sm font-medium border-b border-white/5 last:border-0 leading-tight"
                        >
                          {b.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs text-neutral-500 mb-1">Коментар</label>
                <textarea value={details.comment} onChange={e => setDetails({...details, comment: e.target.value})} placeholder="Додаткові побажання..." className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-colors" />
              </div>

              <label className="flex items-center gap-3 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 cursor-pointer mb-6">
                <input checked={details.doNotCall} onChange={e => setDetails({...details, doNotCall: e.target.checked})} type="checkbox" className="w-5 h-5 accent-indigo-500" />
                <span className="text-sm">Не телефонувати для підтвердження</span>
              </label>

              <div className="flex justify-center w-full md:col-span-2 pt-2">
                <button disabled={loading} type="submit" className="bg-indigo-500 text-white w-full max-w-md py-4 rounded-3xl font-black text-lg active:scale-95 transition-transform shadow-[0_0_30px_rgba(99,102,241,0.3)] disabled:opacity-50 relative z-40 mb-10">
                  {loading ? 'Обробка...' : 'Підтвердити Замовлення'}
                </button>
              </div>
            </div>

          </form>
       )}
    </main>
  );
}
