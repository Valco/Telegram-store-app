'use client';

import { useState, useEffect } from 'react';
import { runSystemDiagnostics } from './actions';

export default function HealthDashboard() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    const res = await runSystemDiagnostics();
    if (res.success) {
      setReport(res.report);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}д`);
    if (h > 0) parts.push(`${h}г`);
    if (m > 0) parts.push(`${m}хв`);
    return parts.join(' ') || '< 1хв';
  };

  const licenseKey = process.env.LICENSE_KEY;
  const isLicensed = !!licenseKey && licenseKey.length > 10;
  // In future: parse JWT to get expiry. For now — show status.
  const licenseStatus = isLicensed ? 'PRO' : 'FREE / Trial';
  const licenseColor = isLicensed ? 'emerald' : 'amber';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* License Status Card */}
      <div className={`bg-${licenseColor}-500/10 border border-${licenseColor}-500/20 p-6 rounded-2xl flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-${licenseColor}-500/20 border border-${licenseColor}-500/30 flex items-center justify-center text-2xl`}>
            {isLicensed ? '🔐' : '🔓'}
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold mb-1">Ліцензія</p>
            <p className={`text-xl font-black text-${licenseColor}-400`}>{licenseStatus}</p>
            {isLicensed
              ? <p className="text-xs text-neutral-400 mt-1">Ключ активовано · Термін дії: перевірте JWT токен</p>
              : <p className="text-xs text-neutral-400 mt-1">Працює у безкоштовному режимі · PRO функції обмежені</p>
            }
          </div>
        </div>
        {!isLicensed && (
          <a
            href="/admin/support"
            className="bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          >
            Отримати PRO →
          </a>
        )}
        {isLicensed && (
          <span className="text-xs font-mono bg-black/30 px-3 py-1.5 rounded-lg text-neutral-400 border border-white/10">
            {licenseKey.slice(0, 8)}...{licenseKey.slice(-4)}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center bg-white/5 border border-white/10 p-6 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <span className="w-3 h-3 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
             Стан Системи та Діагностика
          </h2>
          <p className="text-sm text-neutral-400 mt-1">Опитування внутрішніх вузлів, бази даних та сторонніх API.</p>
        </div>
        <button 
           onClick={fetchDiagnostics}
           disabled={loading}
           className="bg-indigo-500 hover:bg-indigo-400 text-white px-5 py-2 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          {loading ? 'Опитування...' : '🔄 Оновити Дані'}
        </button>
      </div>

      {!report && loading && (
         <div className="text-center py-20 text-neutral-500 animate-pulse">Запуск діагностичних скриптів...</div>
      )}

      {report && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* База Даних */}
            <div className={`p-6 rounded-2xl border ${report.db.status === 'online' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
               <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">🗄 PostgreSQL</h3>
                  <span className="text-xs font-mono bg-black/30 px-2 py-1 rounded text-neutral-400">{report.db.latencyMs}ms</span>
               </div>
               <p className={`font-semibold ${report.db.status === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>{report.db.message}</p>
            </div>

            {/* Telegram Bot */}
            <div className={`p-6 rounded-2xl border ${report.bot.status === 'online' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
               <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">🤖 Telegram API</h3>
                  <span className="text-xs font-mono bg-black/30 px-2 py-1 rounded text-neutral-400">{report.bot.latencyMs}ms</span>
               </div>
               <p className={`font-semibold ${report.bot.status === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>{report.bot.message}</p>
            </div>

            {/* SSL Certificate */}
            <div className={`p-6 rounded-2xl border ${report.ssl.status === 'online' ? 'bg-emerald-500/10 border-emerald-500/20' : report.ssl.status === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
               <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">🔐 SSL Сертифікат</h3>
                  <span className="text-xs font-mono bg-black/30 px-2 py-1 rounded text-neutral-400">{report.ssl.latencyMs}ms</span>
               </div>
               <p className={`font-semibold ${report.ssl.status === 'online' ? 'text-emerald-400' : report.ssl.status === 'warning' ? 'text-yellow-400' : 'text-red-400'}`}>{report.ssl.message}</p>
               {report.ssl.validTo && <p className="text-xs text-neutral-500 mt-2">Придатний до: {report.ssl.validTo}</p>}
            </div>

            {/* Server Stats */}
            <div className="p-6 rounded-2xl border bg-white/5 border-white/10 lg:col-span-3">
               <h3 className="font-bold text-white text-lg flex items-center gap-2 mb-4">🖥 Сервер Node.js</h3>
               <div className="flex flex-wrap gap-8">
                  <div>
                    <p className="text-xs text-neutral-500 mb-1 uppercase tracking-widest font-bold">Час безперервної роботи (Uptime)</p>
                    <p className="text-2xl font-bold text-indigo-400">{formatUptime(report.system.uptimeSec)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1 uppercase tracking-widest font-bold">Споживання Оперативної Пам'яті</p>
                    <p className="text-2xl font-bold text-blue-400">{report.system.ramMb} MB</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 mb-1 uppercase tracking-widest font-bold">Швидкість Діагностики</p>
                    <p className="text-2xl font-bold text-white">{report.totalLatency} ms</p>
                  </div>
               </div>
            </div>

         </div>
      )}
    </div>
  );
}
