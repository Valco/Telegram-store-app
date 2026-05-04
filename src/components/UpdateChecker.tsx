'use client';

import { useState, useEffect } from 'react';
import { getUpdateStatus, performUpdate } from '@/app/admin/update/actions';

const CHECK_KEY = 'update_last_checked';

export default function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const lastChecked = localStorage.getItem(CHECK_KEY);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (!lastChecked || now - parseInt(lastChecked) > oneDayMs) {
      checkUpdate();
    }
  }, []);

  const checkUpdate = async () => {
    const res = await getUpdateStatus();
    if (res.success && res.data?.hasUpdate) {
      setUpdateInfo(res.data);
      setShowPopup(true);
    }
    localStorage.setItem(CHECK_KEY, Date.now().toString());
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setSteps(['⏳ Починаємо оновлення...']);
    const res = await performUpdate();
    if (res.success) {
      setSteps(res.steps || []);
      setDone(true);
    } else {
      setSteps([`❌ Помилка: ${res.error}`]);
    }
    setUpdating(false);
  };

  if (!showPopup || !updateInfo) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#111] border border-indigo-500/30 rounded-3xl p-8 max-w-lg w-full mx-4 shadow-[0_0_60px_rgba(99,102,241,0.2)]">
        
        {!updating && !done && (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-3xl">
                🚀
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Доступне оновлення!</h2>
                <p className="text-sm text-indigo-400 font-mono">v{updateInfo.currentVersion} → v{updateInfo.latestVersion}</p>
              </div>
            </div>

            {/* Release notes */}
            {updateInfo.releaseNotes && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 max-h-40 overflow-y-auto">
                <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold mb-2">Що нового:</p>
                <p className="text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">{updateInfo.releaseNotes}</p>
              </div>
            )}

            {/* Warning */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <p className="text-xs text-amber-300 leading-relaxed">
                Під час оновлення сайт буде недоступний 2-5 хвилин. Рекомендуємо оновлювати у нічний час.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleUpdate}
                className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white py-3 px-5 rounded-xl font-bold transition-all"
              >
                🔄 Оновити зараз
              </button>
              {updateInfo.releaseUrl && (
                <a
                  href={updateInfo.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 border border-white/10 hover:border-white/30 text-neutral-400 hover:text-white rounded-xl transition-all text-sm flex items-center"
                >
                  Changelog ↗
                </a>
              )}
              <button
                onClick={() => setShowPopup(false)}
                className="px-4 py-3 border border-white/10 hover:border-white/20 text-neutral-500 hover:text-white rounded-xl transition-all text-sm"
              >
                Нагадати пізніше
              </button>
            </div>
          </>
        )}

        {/* Progress */}
        {(updating || (done && steps.length > 0)) && (
          <>
            <div className="flex items-center gap-3 mb-6">
              {updating && <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />}
              {done && <span className="text-2xl">✅</span>}
              <h2 className="text-xl font-black text-white">
                {updating ? 'Оновлення...' : 'Оновлення завершено!'}
              </h2>
            </div>
            <div className="bg-black/50 rounded-xl p-4 space-y-2 mb-6 font-mono text-sm max-h-60 overflow-y-auto">
              {steps.map((step, i) => (
                <p key={i} className={step.startsWith('✅') ? 'text-emerald-400' : step.startsWith('❌') ? 'text-red-400' : 'text-neutral-400'}>
                  {step}
                </p>
              ))}
              {updating && <p className="text-neutral-500 animate-pulse">▌</p>}
            </div>
            {done && (
              <button
                onClick={() => { setShowPopup(false); window.location.reload(); }}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl font-bold transition-all"
              >
                Перезавантажити сторінку
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
