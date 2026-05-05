'use client';

import { useState } from 'react';
import { LicenseInfo } from '@/lib/license';
import { saveLicenseKey } from './actions';
import { useRouter } from 'next/navigation';

export default function LicenseClient({ initialLicense }: { initialLicense: LicenseInfo }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSave = async () => {
    if (!key.trim()) return alert('Введіть ключ');
    setLoading(true);
    const res = await saveLicenseKey(key.trim());
    if (res.success) {
      alert('Ключ збережено! Сторінка буде перезавантажена для перевірки.');
      window.location.reload();
    } else {
      alert('Помилка збереження: ' + res.error);
      setLoading(false);
    }
  };

  const statusColor = initialLicense.valid ? 'emerald' : 'amber';
  const statusIcon = initialLicense.valid ? '✅' : '⚠️';

  return (
    <div className="max-w-3xl space-y-8">
      {/* Current Status Card */}
      <div className={`bg-${statusColor}-500/10 border border-${statusColor}-500/30 rounded-3xl p-8`}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <span>{statusIcon}</span>
              {initialLicense.valid ? 'Ліцензія Активна (PRO)' : 'Ліцензія не активована (FREE)'}
            </h2>
            <p className="text-neutral-400">
              {initialLicense.valid 
                ? 'Всі функції розблоковані. Приємного користування!' 
                : 'Застосунок працює в обмеженому режимі.'}
            </p>
            {initialLicense.reason === 'expired' && <p className="text-red-400 mt-2">Термін дії ліцензії закінчився.</p>}
            {initialLicense.reason === 'invalid_key' && <p className="text-red-400 mt-2">Недійсний ключ ліцензії.</p>}
          </div>
          {initialLicense.valid && (
            <div className={`bg-${statusColor}-500/20 text-${statusColor}-400 px-4 py-2 rounded-xl font-bold`}>
              {initialLicense.plan.toUpperCase()} PLAN
            </div>
          )}
        </div>

        {initialLicense.valid && (
          <div className="grid grid-cols-2 gap-6 mt-8 pt-8 border-t border-white/10">
            <div>
              <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold mb-1">Домен прив'язки</p>
              <p className="text-white font-mono">{initialLicense.domain || 'Універсальний'}</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold mb-1">Дійсна до</p>
              <p className="text-white">{initialLicense.expiresAt ? new Date(initialLicense.expiresAt).toLocaleDateString('uk-UA') : 'Назавжди'}</p>
              {initialLicense.daysLeft > 0 && <p className="text-xs text-neutral-400 mt-1">Залишилось днів: {initialLicense.daysLeft}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Feature List */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
        <h3 className="text-lg font-bold text-white mb-6">Доступні модулі</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { id: 'SMM', name: 'SMM Автопостинг' },
            { id: 'AI', name: 'AI Асистент' },
            { id: 'ROULETTE', name: 'Колесо Фортуни' },
            { id: 'UNLIMITED_PRODUCTS', name: 'Безлімітні товари' },
          ].map(f => {
            const hasIt = initialLicense.valid && initialLicense.features.includes(f.id as any);
            return (
              <div key={f.id} className={`p-4 rounded-xl border ${hasIt ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-black/30 border-white/5 opacity-50'}`}>
                <div className="text-2xl mb-2">{hasIt ? '✨' : '🔒'}</div>
                <div className="font-bold text-sm text-white">{f.name}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enter Key */}
      <div className="bg-[#111] border border-white/10 rounded-3xl p-8">
        <h3 className="text-lg font-bold text-white mb-4">Оновлення ключа</h3>
        <p className="text-sm text-neutral-400 mb-6">Вставте новий ліцензійний ключ (JWT), який ви отримали від розробника.</p>
        
        <textarea
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
          className="w-full h-32 bg-black/50 border border-white/10 rounded-xl p-4 text-white font-mono text-sm focus:border-indigo-500 outline-none transition-all resize-none mb-4"
        ></textarea>

        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          {loading ? 'Збереження...' : 'Активувати ключ'}
        </button>
      </div>
      {/* Get License */}
      <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border border-indigo-500/20 rounded-3xl p-8">
        <h3 className="text-lg font-bold text-white mb-2">Готові розпочати?</h3>
        <p className="text-neutral-400 text-sm mb-6">
          Зв'яжіться з нами для отримання PRO ліцензії та налаштування
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="https://t.me/drukhouse3d"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-[#229ED9]/10 border border-[#229ED9]/30 hover:bg-[#229ED9]/20 px-5 py-3 rounded-xl transition-all group"
          >
            <span className="text-2xl">📱</span>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Telegram</p>
              <p className="text-white font-mono font-bold group-hover:text-[#229ED9] transition-colors">@drukhouse3d</p>
            </div>
          </a>
          <a
            href="mailto:drukhouse3d@gmail.com"
            className="flex items-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 px-5 py-3 rounded-xl transition-all group"
          >
            <span className="text-2xl">✉️</span>
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Email</p>
              <p className="text-white font-mono font-bold group-hover:text-indigo-400 transition-colors">drukhouse3d@gmail.com</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
