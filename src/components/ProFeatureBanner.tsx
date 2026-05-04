'use client';

import Link from 'next/link';

interface ProFeatureBannerProps {
  featureName: string;
  description: string;
}

export default function ProFeatureBanner({ featureName, description }: ProFeatureBannerProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md rounded-2xl">
      <div className="bg-[#0d0d14] border border-indigo-500/30 p-8 rounded-3xl max-w-md text-center shadow-2xl">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-xl font-bold text-white mb-2">{featureName}</h3>
        <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
          {description} Ця функція доступна лише у PRO версії Telegram Store.
        </p>
        <Link 
          href="/admin/license" 
          className="inline-block bg-indigo-500 hover:bg-indigo-400 text-white font-bold py-3 px-8 rounded-xl transition-all"
        >
          Отримати PRO Ліцензію →
        </Link>
      </div>
    </div>
  );
}
