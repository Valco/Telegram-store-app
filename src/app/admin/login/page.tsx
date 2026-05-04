'use client';

import { useState, useRef, useEffect } from 'react';
import { loginAdmin, verifyAdminOtp } from './actions';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [otpStep, setOtpStep] = useState(false);
  const [userId, setUserId] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otpStep && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [otpStep]);

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const result = await loginAdmin(formData);

    if (result.success) {
      if (result.requireOtp && result.userId) {
        setUserId(result.userId);
        setOtpStep(true);
        setLoading(false);
      } else {
        window.location.href = '/admin';
      }
    } else {
      setError(result.error || 'Помилка');
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    formData.append('userId', userId);
    
    const result = await verifyAdminOtp(formData);

    if (result.success) {
      window.location.href = '/admin';
    } else {
      setError(result.error || 'Невірний код');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="absolute top-0 left-0 w-full h-96 bg-purple-900/10 blur-[120px] pointer-events-none -z-10" />

      <div className="w-full max-w-sm bg-black/40 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Adminius
          </h1>
          <p className="text-neutral-500 text-sm mt-1">Панель Управління Магазином</p>
        </div>

        {!otpStep ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Email (Логін)</label>
              <input 
                type="email" 
                name="email"
                defaultValue="admin@tel.bot"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Пароль</label>
              <input 
                type="password" 
                name="password"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                placeholder="Введіть пароль"
                required
              />
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs font-medium text-center">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-white text-black font-bold py-3 rounded-xl mt-4 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? 'Перевірка...' : 'Увійти'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl mb-6 text-center">
               <span className="text-2xl mb-2 block">📧</span>
               <p className="text-sm text-indigo-300">Код підтвердження відправлено на ваш Email (та Telegram, якщо підключений)!</p>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1 text-center">Код З Листа</label>
              <input 
                ref={otpInputRef}
                type="text" 
                name="code"
                maxLength={6}
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl tracking-[0.5em] text-center focus:outline-none focus:border-indigo-500 transition-colors" 
                placeholder="------"
                required
                autoFocus
                autoComplete="one-time-code"
              />
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-xs font-medium text-center">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 rounded-xl mt-4 active:scale-95 transition-colors disabled:opacity-50 flex items-center justify-center shadow-lg shadow-indigo-500/20"
            >
              {loading ? 'Перевірка...' : 'Підтвердити Вхід'}
            </button>
            <button 
              type="button" 
              onClick={() => { setOtpStep(false); setError(''); }}
              className="w-full text-xs text-neutral-500 mt-4 hover:text-white transition-colors"
            >
              Повернутися назад
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
