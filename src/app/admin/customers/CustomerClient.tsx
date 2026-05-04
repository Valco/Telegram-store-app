'use client';

import React, { useState } from 'react';
import { checkTelegramBotStatus } from './actions';

function BotStatusChecker({ userId, telegramId, dbStatus }: { userId: string, telegramId: any, dbStatus: string | null }) {
  const [status, setStatus] = useState<string | null>(dbStatus);
  const [loading, setLoading] = useState(false);

  if (!telegramId) {
    return <span className="text-xs text-neutral-500">Немає TG</span>;
  }

  const check = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setLoading(true);
    const res = await checkTelegramBotStatus(userId);
    if (res.success) {
       setStatus(res.status || null);
    } else {
       setStatus('ERROR');
    }
    setLoading(false);
  };

  const getLabel = (s: string) => {
      if (s === 'ACTIVE') return '✅ Підписаний';
      if (s === 'NOT_STARTED') return '❌ Не запускав';
      if (s === 'BLOCKED') return '🚫 Заблокував';
      if (s === 'NOT_FOUND') return '🔎 Не знайдено';
      return s;
  };

  if (status) {
    return (
       <div className="flex items-center gap-2 justify-center">
         <span className={`text-xs font-bold whitespace-nowrap ${status === 'ACTIVE' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {getLabel(status)}
         </span>
         <button onClick={check} disabled={loading} className="text-[10px] text-neutral-500 hover:text-white transition" title="Оновити статус">
            {loading ? '⏳' : '🔄'}
         </button>
       </div>
    );
  }

  return (
    <button onClick={check} disabled={loading} className="text-[10px] bg-white/10 hover:bg-indigo-500/50 border border-white/20 hover:border-indigo-500 px-3 py-1.5 rounded-lg transition disabled:opacity-50 text-indigo-300 font-bold whitespace-nowrap shadow-lg">
      {loading ? '...' : 'Перевірити'}
    </button>
  );
}

export default function CustomerClient({ customers }: { customers: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resetDone, setResetDone] = useState(false);

  const toggleRow = (id: string) => {
    if (expandedId === id) setExpandedId(null);
    else setExpandedId(id);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white/5 border border-white/10 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">База Клієнтів</h2>
          <p className="text-sm text-neutral-400">Аналітика поведінки, баланс монет та контакти користувачів.</p>
        </div>
        <button 
          onClick={() => {
            localStorage.removeItem('tg_notification_allowed');
            setResetDone(true);
            setTimeout(() => setResetDone(false), 3000);
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition ${resetDone ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500 hover:text-white'}`}
        >
          {resetDone ? '✅ Таймер скинуто!' : '⏱ Скинути таймер підписок'}
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-sm text-neutral-400">
          <thead className="bg-white/5 text-neutral-300 text-xs uppercase tracking-wider border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-semibold">TG User</th>
              <th className="px-6 py-4 font-semibold">Телефон</th>
              <th className="px-6 py-4 font-semibold text-center">Замовлень</th>
              <th className="px-6 py-4 font-semibold text-center">Бот</th>
              <th className="px-6 py-4 font-semibold">Баланс Монет</th>
              <th className="px-6 py-4 font-semibold text-right">Останній Візит</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {customers.map((c: any) => (
              <React.Fragment key={c.id}>
                <tr 
                  onClick={() => toggleRow(c.id)}
                  className={`hover:bg-white/5 transition-colors cursor-pointer ${expandedId === c.id ? 'bg-white/5' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div className="text-white font-medium">{c.firstName || 'Гість'} {c.lastName || ''}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{c.username ? `@${c.username}` : `ID: ${c.telegramId}`}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-indigo-300">
                    {c.phone || 'Не вказано'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-bold text-white">{c._count?.orders}</span>
                    {c._count?.orders > 0 && <div className="text-[10px] text-indigo-400 mt-1">Клік для деталей</div>}
                  </td>
                  <td className="px-6 py-4 text-center">
                     <BotStatusChecker userId={c.id} telegramId={c.telegramId} dbStatus={c.botSubscriptionStatus} />
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-bold">
                      🪙 {c.coinsBalance}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs">
                    {c.lastLoginAt ? new Date(c.lastLoginAt).toLocaleDateString('uk-UA') : '-'}
                  </td>
                </tr>
                
                {/* Розгорнутий рядок з замовленнями */}
                {expandedId === c.id && (
                  <tr className="bg-[#0a0a0a] border-b border-white/10">
                    <td colSpan={6} className="p-6">
                      <div className="bg-[#111] border border-white/10 rounded-xl p-5">
                        <h4 className="text-white font-bold mb-4">Історія Замовлень ({c.orders?.length || 0})</h4>
                        {(!c.orders || c.orders.length === 0) ? (
                          <div className="text-sm text-neutral-500">Клієнт ще не робив замовлень</div>
                        ) : (
                          <div className="space-y-3">
                            {c.orders.map((o: any) => (
                              <div key={o.id} className="flex items-center justify-between bg-white/5 p-4 rounded-lg border border-white/5">
                                <div className="flex flex-col">
                                  <span className="font-mono text-indigo-400 text-xs font-bold mb-1">№ {o.orderNumber}</span>
                                  <span className="text-neutral-400 text-xs">{new Date(o.createdAt).toLocaleString('uk-UA')}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-neutral-400 line-clamp-1 max-w-[200px]">
                                    {o.items.map((i: any) => `${i.product?.name || 'Видалений'} x${i.quantity}`).join(', ')}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-emerald-400 font-bold">{(o.finalAmount / 100).toFixed(2)} ₴</span>
                                  <span className={`text-[10px] uppercase font-bold mt-1 px-2 py-0.5 rounded ${o.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                    {o.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">
                  Поки немає жодного клієнта
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
