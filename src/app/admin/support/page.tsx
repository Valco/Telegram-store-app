'use client';

export const dynamic = 'force-dynamic';

export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-5 shadow-[0_0_40px_rgba(251,191,36,0.15)]">
          <span className="text-4xl">☕</span>
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Підтримати автора</h1>
        <p className="text-neutral-400 text-base leading-relaxed max-w-lg mx-auto">
          Цей проект створювався з любов&apos;ю до деталей і щирим бажанням зробити щось корисне для українського бізнесу.
        </p>
      </div>

      {/* Main card */}
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 rounded-3xl p-8 mb-6 shadow-[0_0_50px_rgba(251,191,36,0.05)]">
        <p className="text-neutral-300 text-base leading-relaxed mb-6">
          Якщо цей інструмент допоміг вам запустити магазин, заощадив час або просто сподобався — буду щиро вдячний за будь-яку підтримку. Це надихає розвивати проект далі, додавати нові функції та вдосконалювати вже існуючі.
        </p>

        <p className="text-neutral-300 text-base leading-relaxed">
          Навіть маленька кава — це великий знак уваги. Дякую від усього серця! 🙏
        </p>
      </div>

      {/* Monobank Jar */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-4 hover:border-amber-500/30 transition-colors group">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
            🏦
          </div>
          <div>
            <p className="font-bold text-white">Monobank — Банка</p>
            <p className="text-xs text-neutral-500">Натисніть посилання або скануйте QR прямо в застосунку Monobank</p>
          </div>
        </div>
        <a
          href="https://send.monobank.ua/jar/9YQcvpTs23"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 hover:bg-amber-500/20 transition-all group-hover:shadow-[0_0_20px_rgba(251,191,36,0.1)]"
        >
          <span className="text-amber-400 font-mono font-bold text-sm break-all">
            send.monobank.ua/jar/9YQcvpTs23
          </span>
          <span className="text-amber-400 text-lg ml-3 flex-shrink-0">↗</span>
        </a>
      </div>

      {/* Card number */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-8 hover:border-white/20 transition-colors">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
            💳
          </div>
          <div>
            <p className="font-bold text-white">Номер картки</p>
            <p className="text-xs text-neutral-500">Monobank — для переказу через будь-який банк</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between">
          <span className="text-white font-mono font-bold text-lg tracking-widest">
            4441 1111 2169 6391
          </span>
          <button
            onClick={() => navigator.clipboard.writeText('4441111121696391')}
            className="text-xs text-neutral-500 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors ml-3 flex-shrink-0"
          >
            Копіювати
          </button>
        </div>
      </div>

      {/* Ukraine flag section */}
      <div className="text-center py-8 border-t border-white/5">
        <div className="text-5xl mb-4">🇺🇦</div>
        <p className="text-2xl font-black text-white tracking-wide">
          Слава Україні!
        </p>
        <p className="text-neutral-500 text-sm mt-3">
          Зроблено в Україні з ❤️
        </p>
      </div>

    </div>
  );
}
