'use client';

import { useState, useEffect } from 'react';
import { useStore } from './StoreProvider';

export default function GlobalRoulette() {
  const { user, token, refreshUser } = useStore();
  
  const [slices, setSlices] = useState<{discount: number, chance: number}[]>([]);
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [localSpunStamp, setLocalSpunStamp] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const val = localStorage.getItem('lastRouletteSpin');
    if (val) setLocalSpunStamp(parseInt(val, 10));

    fetch('/api/gamification/config')
      .then(r => r.json())
      .then(d => {
        if (d.success) setSlices(d.slices);
      })
      .catch(e => console.error('Failed to fetch gamification config'));
  }, []);

  const hasActiveDiscount = user?.activeDiscountPercent && user?.discountExpiresAt && new Date(user.discountExpiresAt) > new Date();
  const recentSpin = Date.now() - localSpunStamp < 24 * 60 * 60 * 1000;
  const hasAlreadySpun = (user?.activeDiscountPercent != null) || recentSpin || user?.hasRecentSpin;

  useEffect(() => {
    // If the component is mounted, user is loaded, and user hasn't spun, auto-open roulette.
    // Delay slightly to avoid jarring UI pop-in.
    if (mounted && user && !hasAlreadySpun) {
      const timer = setTimeout(() => {
        setIsRouletteOpen(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mounted, user, hasAlreadySpun]);

  const handleSpin = async () => {
    if (!token) return alert('Помилка. Сторінку потрібно відкрити в межах Telegram.');
    
    setIsSpinning(true);
    
    try {
      const res = await fetch('/api/gamification/spin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (!res.ok || data.error) {
        alert(data.error || 'Сталася помилка на сервері');
        setIsSpinning(false);
        setIsRouletteOpen(false);
        
        if (data.error && data.error.includes('24 години')) {
           localStorage.setItem('lastRouletteSpin', Date.now().toString());
           setLocalSpunStamp(Date.now());
        }
        return;
      }
      
      const discount = data.discountPercent || data.discount;
      
      // Calculate wheel stopping rotation
      const baseSlices = slices.map(s => s.discount);
      const R = Math.max(1, Math.floor(12 / Math.max(1, baseSlices.length)));
      const finalSlicesLength = baseSlices.length * R;
      const sliceDegrees = 360 / finalSlicesLength;
      
      const baseIndex = baseSlices.findIndex(d => d === discount);
      const randomQuadrant = Math.floor(Math.random() * R);
      const targetSliceIndex = randomQuadrant * baseSlices.length + baseIndex;
      
      const sliceCenterAngle = targetSliceIndex * sliceDegrees + (sliceDegrees / 2);
      const randomWiggle = (Math.random() - 0.5) * (sliceDegrees * 0.6);
      
      const finalTargetDegree = 3600 + (360 - sliceCenterAngle) + randomWiggle;
      
      setWheelRotation(prev => prev + finalTargetDegree);
      
      setTimeout(() => {
        setIsSpinning(false);
        
        setTimeout(() => {
          setSpinResult(discount);
          localStorage.setItem('lastRouletteSpin', Date.now().toString());
          setLocalSpunStamp(Date.now());
          refreshUser();
        }, 1500);
      }, 3000);

    } catch (e) {
      alert('Помилка мережі (Server 500)');
      setIsSpinning(false);
      setIsRouletteOpen(false);
    }
  };

  if (!mounted || slices.length === 0) return null;

  const baseSlices = slices.map(s => s.discount);
  const R = Math.max(1, Math.floor(12 / Math.max(1, baseSlices.length)));
  const finalSlicesLength = baseSlices.length * R;
  const sliceDegrees = 360 / finalSlicesLength;
  const sliceValues = Array(R).fill(baseSlices).flat();

  let gradientStr = '';
  if (finalSlicesLength > 0) {
    const parts = [];
    const colors = ['#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#1e1b4b', '#111827'];
    for (let i = 0; i < finalSlicesLength; i++) {
      const startAngle = i * sliceDegrees;
      const endAngle = (i + 1) * sliceDegrees;
      const color = colors[i % colors.length];
      parts.push(`${color} ${startAngle}deg ${endAngle}deg`);
    }
    gradientStr = `conic-gradient(${parts.join(', ')})`;
  }

  return (
    <>
      {isRouletteOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl view-mode">
           <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-[40px] p-8 text-center shadow-2xl relative overflow-hidden animate-in zoom-in-75 duration-300">
             
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-indigo-500/30 blur-[100px] rounded-full pointer-events-none" />

             <h2 className="text-2xl sm:text-3xl font-black mb-8 sm:mb-10 text-white">Барабан Знижок</h2>
             
             <div className="relative aspect-square w-[90%] max-w-[320px] mx-auto mb-10 sm:mb-12">
               <div className="absolute top-[-8%] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] border-t-white z-20 drop-shadow-[0_5px_5px_rgba(0,0,0,0.5)]" />
               
               <div 
                 className="w-full h-full rounded-full border-[6px] border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.5)] relative overflow-hidden"
                 style={{ 
                   background: gradientStr,
                   transform: `rotate(${wheelRotation}deg)`,
                   transition: 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)'
                 }}
               >
                 {sliceValues.map((val, idx) => {
                   const rotation = idx * sliceDegrees + (sliceDegrees / 2);
                   return (
                     <div key={idx} className="absolute inset-0 flex" style={{ transform: `rotate(${rotation}deg)` }}>
                       <span className="mt-4 mx-auto font-black text-sm text-white drop-shadow-md z-10 w-8 text-center" style={{ transform: `rotate(0deg)` }}>
                         {val}%
                       </span>
                     </div>
                   );
                 })}
                 
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-[#111] rounded-full border-[3px] border-white/10 z-10 flex items-center justify-center shadow-lg">
                   <span className="text-2xl sm:text-3xl">🎰</span>
                 </div>
               </div>
             </div>

             <button 
               onClick={handleSpin} 
               disabled={isSpinning || hasAlreadySpun}
               className="w-full bg-white text-black rounded-3xl py-4 font-black text-xl active:scale-95 transition-transform hover:bg-neutral-200 disabled:opacity-50 disabled:scale-100 shadow-[0_0_20px_rgba(255,255,255,0.2)] relative z-10"
             >
               {isSpinning ? 'Крутимо...' : 'КРУТИТИ!'}
             </button>
             
             {!isSpinning && (
               <button onClick={() => setIsRouletteOpen(false)} className="mt-6 text-sm font-bold text-neutral-500 hover:text-white transition-colors relative z-10">
                 Закрити вікно
               </button>
             )}
           </div>
        </div>
      )}

      {/* POPUP WINNER MODAL */}
      {spinResult && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="w-full max-w-sm bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f] border border-emerald-500/30 rounded-[40px] p-8 text-center shadow-[0_0_100px_rgba(16,185,129,0.2)] relative overflow-hidden animate-in zoom-in-50 duration-500 slide-in-from-bottom-10">
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20" />
              
              <div className="text-7xl mb-6">🎉</div>
              <h2 className="text-3xl font-black mb-2 text-white">Вітаємо!</h2>
              <p className="text-neutral-400 mb-6">Ви виграли величезну знижку на своє перше замовлення!</p>
              
              <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-3xl py-6 mb-8 transform scale-110 shadow-2xl">
                 <div className="text-6xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">-{spinResult}%</div>
              </div>

              <div className="bg-[#111] rounded-2xl p-4 mb-8 border border-white/5">
                 <p className="text-sm font-medium text-neutral-300 flex items-center justify-center gap-2">
                   <span>⏱</span> Знижка діє всього <strong className="text-white">60 хвилин</strong>! Не пропустіть можливість.
                 </p>
              </div>

              <button 
                onClick={() => {
                  setSpinResult(null);
                  setIsRouletteOpen(false); 
                }} 
                className="w-full bg-emerald-500 text-white rounded-2xl py-5 font-black text-xl active:scale-95 transition-transform hover:bg-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] relative z-10"
              >
                Забрати знижку та купити
              </button>
           </div>
        </div>
      )}
    </>
  );
}
