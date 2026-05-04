'use client';

import { useState } from 'react';
import { updateSettings } from './actions';
import { createPrompt, updatePrompt, deletePrompt } from './promptActions';
import { createSocialAccount, deleteSocialAccount } from './socialActions';

export default function SettingsClient({ settings, initialPrompts, initialSocialAccounts }: { settings: any, initialPrompts: any[], initialSocialAccounts: any[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);

  // Prompts State
  const [prompts, setPrompts] = useState(initialPrompts || []);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [deletingPrompt, setDeletingPrompt] = useState<any>(null);

  // SMM & Social Accounts State
  const [socialAccounts, setSocialAccounts] = useState(initialSocialAccounts || []);
  const [isSocialModalOpen, setIsSocialModalOpen] = useState(false);
  const [deletingSocial, setDeletingSocial] = useState<any>(null);
  let initPRPrompts: string[] = [];
  if (settings.photoroomPrompts && Array.isArray(settings.photoroomPrompts) && settings.photoroomPrompts.length > 0) {
    initPRPrompts = settings.photoroomPrompts;
  } else {
    initPRPrompts = [
      "A bright, colorful children's playroom with soft natural light coming from a window. Wooden blocks and blurred toys in the background.",
      "A clean, modern minimalist studio with a solid pastel blue background and soft studio lighting.",
      "A cozy wooden desk with a small desk lamp casting a warm glow, with colorful fairy lights softly blurred in the background."
    ];
  }
  const [photoroomPrompts, setPhotoroomPrompts] = useState<string[]>(initPRPrompts);

  // Default roulette chances if not set in DB
  const defaultSlices = [
    { discount: 10, chance: 50 },
    { discount: 25, chance: 30 },
    { discount: 50, chance: 15 },
    { discount: 75, chance: 5 }
  ];
  
  let initialSlices = defaultSlices;
  if (settings?.rouletteWinChances) {
    if (typeof settings.rouletteWinChances === 'string') {
      try { initialSlices = JSON.parse(settings.rouletteWinChances); } catch(e){}
    } else if (Array.isArray(settings.rouletteWinChances)) {
      initialSlices = settings.rouletteWinChances as any;
    }
  }

  const [slices, setSlices] = useState<{discount: number, chance: number}[]>(initialSlices);

  // Validate the total
  const totalChance = slices.reduce((acc, curr) => acc + curr.chance, 0);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMsg('');
    setError('');

    if (totalChance !== 100) {
      setError('Сума шансів у Рулетці має дорівнювати рівно 100%');
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append('rouletteWinChances', JSON.stringify(slices));
    
    // Process Prompts
    const finalPR = photoroomPrompts.filter(p => p.trim().length > 0);
    formData.set('photoroomPrompts', JSON.stringify(finalPR));
    formData.append('enablePickup', formData.get('enablePickupCheck') === 'on' ? 'true' : 'false');

    const res = await updateSettings(formData);
    if (res.success) {
      setSuccessMsg('Налаштування успішно збережено!');
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
    
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleUpdateSlice = (index: number, field: 'discount'|'chance', value: string) => {
    const num = parseInt(value, 10);
    setSlices(prev => {
      const copy = [...prev];
      copy[index][field] = isNaN(num) ? 0 : num;
      return copy;
    });
  };

  const handleAddSlice = () => setSlices([...slices, { discount: 5, chance: 0 }]);
  const handleRemoveSlice = (index: number) => setSlices(slices.filter((_, i) => i !== index));

  // Prompt Handlers
  const handleSavePrompt = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = editingPrompt 
      ? await updatePrompt(editingPrompt.id, formData)
      : await createPrompt(formData);
    
    if (res.success) {
       // Refresh page logic or just let revalidatePath do its job
       window.location.reload();
    } else {
       setError(res.error || 'Помилка збереження промпту');
    }
    setLoading(false);
  };

  const executeDeletePrompt = async () => {
    if (!deletingPrompt) return;
    setLoading(true);
    const res = await deletePrompt(deletingPrompt.id);
    if (res.success) {
      window.location.reload();
    } else {
      setError(res.error || 'Помилка');
      setDeletingPrompt(null);
    }
    setLoading(false);
  };

  const handleSaveSocial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await createSocialAccount(formData);
    if (res.success) window.location.reload();
    else setError(res.error || 'Помилка');
    setLoading(false);
  };

  const handleUpdateSMM = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const finalPR = photoroomPrompts.filter(p => p.trim().length > 0);
    formData.set('photoroomPrompts', JSON.stringify(finalPR));
    formData.append('enablePickup', formData.get('enablePickupCheck') === 'on' ? 'true' : 'false');
    const res = await updateSettings(formData);
    if (res.success) {
      window.location.reload();
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const executeDeleteSocial = async () => {
    if (!deletingSocial) return;
    setLoading(true);
    const res = await deleteSocialAccount(deletingSocial.id);
    if (res.success) window.location.reload();
    else { setError(res.error || 'Помилка'); setDeletingSocial(null); }
    setLoading(false);
  };

  const [activeTab, setActiveTab] = useState('main');

  const tabs = [
    { id: 'main', label: 'Головні', icon: '⚙️' },
    { id: 'loyalty', label: 'Лояльність', icon: '🎁' },
    { id: 'storage', label: 'Сховище', icon: '☁️' },
    { id: 'ai', label: 'AI Модулі', icon: '✨' },
    { id: 'smm', label: 'SMM Автоматизація', icon: '📱' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl relative">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Глобальні Налаштування</h2>
        <p className="text-sm text-neutral-400">Конфігурація лояльності, безпеки та інтеграцій.</p>
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-4 mb-6 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-rose-500/20 text-rose-400 p-4 rounded-xl border border-rose-500/30 text-sm font-bold">{error}</div>}
      {successMsg && <div className="bg-emerald-500/20 text-emerald-400 p-4 rounded-xl border border-emerald-500/30 text-sm font-bold">{successMsg}</div>}

      <form onSubmit={handleSubmit} className="space-y-6 pb-20">
        <input type="hidden" name="id" value={settings.id} />
        
        {/* Вкладка Головні */}
        <div className={activeTab === 'main' ? 'space-y-6 block' : 'hidden'}>

          {/* Назва магазину */}
          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-medium text-indigo-400 mb-4 border-b border-indigo-500/20 pb-2 flex items-center gap-2">
              🏪 Ідентифікація Магазину
            </h3>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Назва Магазину <span className="text-indigo-400 text-xs">(відображається скрізь: чеки, листи, SMM)</span>
              </label>
              <input
                type="text"
                name="siteName"
                placeholder="Telegram Store"
                defaultValue={settings.siteName || 'Telegram Store'}
                className="w-full max-w-md bg-[#0a0a0a] border border-indigo-500/30 rounded-lg px-4 py-2.5 text-white text-lg font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-xs text-neutral-500 mt-2">Використовується в чеках, email-сповіщеннях, SMM-постах та заголовку адмін-панелі.</p>
            </div>
          </div>

          {/* Аналітика */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-medium text-purple-400 mb-4 border-b border-white/10 pb-2">Аналітика та SEO</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Google Analytics ID</label>
                <input 
                  type="text" 
                  name="googleAnalyticsId" 
                  placeholder="G-XXXXXXXXXX"
                  defaultValue={settings.googleAnalyticsId || ''}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Meta (Facebook) Pixel ID</label>
                <input 
                  type="text" 
                  name="metaPixelId" 
                  placeholder="123456789012345"
                  defaultValue={settings.metaPixelId || ''}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors" 
                />
              </div>
            </div>
          </div>

          {/* Сповіщення */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-medium text-pink-400 mb-4 border-b border-white/10 pb-2">Сповіщення (Замовлення)</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Email для нових замовлень</label>
                <input 
                  type="email" 
                  name="adminEmail" 
                  placeholder="admin@yourdomain.com"
                  defaultValue={settings.adminEmail || ''}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-pink-500 transition-colors" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">ID Telegram-групи</label>
                <input 
                  type="text" 
                  name="telegramGroupId" 
                  placeholder="-100123456789"
                  defaultValue={settings.telegramGroupId || ''}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-pink-500 transition-colors" 
                />
                <p className="text-xs text-neutral-500 mt-1">Токен бота повинен бути прописаний в файлі .env</p>
              </div>
            </div>
          </div>

          {/* Pickup Settings */}
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-medium text-emerald-400 mb-4 border-b border-white/10 pb-2">🏪 Самовивіз</h3>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" name="enablePickupCheck" defaultChecked={settings.enablePickup !== false} className="w-5 h-5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0" />
                <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">Показувати опцію самовивозу при оформленні</span>
              </label>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Адреса для самовивозу <span className="text-xs text-neutral-500">(відображається покупцям)</span></label>
                <input
                  type="text"
                  name="pickupAddress"
                  defaultValue={settings.pickupAddress || ''}
                  placeholder="вул. Прикладна 12, м. Черкаси, ТЦ Центр, 2-й поверх"
                  className="w-full bg-[#0a0a0a] border border-emerald-500/30 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <p className="text-xs text-neutral-500 mt-2">Ця адреса відображається покупцям при виборі "Самовивіз" на сторінці оформлення.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Вкладка Лояльність */}
        <div className={activeTab === 'loyalty' ? 'space-y-6 block' : 'hidden'}>
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-medium text-indigo-400 mb-4 border-b border-white/10 pb-2">Лояльність та Гейміфікація</h3>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Курс монет (1 Грн = Х Монет)</label>
                <input 
                  type="number" 
                  name="coinToUahRate" 
                  defaultValue={settings.coinToUahRate}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                />
                <p className="text-xs text-neutral-500 mt-1">Курс обміну знижки.</p>
              </div>
              <div>
                 <label className="block text-sm font-medium text-neutral-300 mb-2">Привітальний Бонус</label>
                 <input 
                   type="number" 
                   name="welcomeBonusCoins" 
                   defaultValue={settings.welcomeBonusCoins ?? 1000}
                   className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-yellow-500 font-bold focus:outline-none focus:border-indigo-500 transition-colors" 
                 />
                 <p className="text-xs text-neutral-500 mt-1">Видається при першій реєстрації.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Макс. сплата монетами (%)</label>
                <input 
                  type="number" 
                  name="maxCoinsPercent" 
                  defaultValue={settings.maxCoinsPercent}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                />
                <p className="text-xs text-neutral-500 mt-1">Скільки чека можна вкрити цими монетами.</p>
              </div>
              <div>
                 <label className="block text-sm font-medium text-neutral-300 mb-2">Кешбек за покупки (%)</label>
                 <input 
                   type="number" 
                   name="cashbackPercent" 
                   defaultValue={settings.cashbackPercent ?? 0}
                   className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-emerald-400 font-bold focus:outline-none focus:border-indigo-500 transition-colors" 
                 />
                 <p className="text-xs text-neutral-500 mt-1">Монети повертаються після оплати.</p>
              </div>
              <div className="col-span-2 md:col-span-2 lg:col-span-4 mt-2 border-t border-white/5 pt-4">
                <label className="block text-sm font-medium text-neutral-300 mb-2">Налаштування шансу Рулетки</label>
                <button 
                  type="button"
                  onClick={() => setIsRouletteOpen(true)}
                  className="w-full max-w-sm bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-500/50 rounded-lg px-4 py-2.5 text-indigo-300 font-bold text-center transition-colors"
                >
                  [ Відкрити конструктор ]
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Вкладка Сховище */}
        <div className={activeTab === 'storage' ? 'space-y-6 block' : 'hidden'}>
          <div className="bg-white/5 border border-white/10 p-6 rounded-2xl shadow-xl">
            <h3 className="text-lg font-medium text-emerald-400 mb-4 border-b border-white/10 pb-2">Файлове сховище (Фото/Відео)</h3>
            
            <div className="mb-6">
               <label className="block text-sm font-medium text-neutral-300 mb-2">Провайдер сховища</label>
               <select name="storageProvider" defaultValue={settings.storageProvider} className="w-full max-w-xs bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors">
                 <option value="local">Локальний Сервер (/uploads)</option>
                 <option value="s3">Amazon S3 (Хмара)</option>
               </select>
            </div>

            <div className="grid grid-cols-2 gap-6 p-4 bg-black/30 rounded-xl border border-white/5">
              <div className="col-span-2">
                <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="font-bold text-emerald-400 text-sm mb-1">AWS-ключі захищені в .env</p>
                    <p className="text-xs text-neutral-400">Ключі <code className="text-emerald-300">AWS_ACCESS_KEY_ID</code>, <code className="text-emerald-300">AWS_SECRET_ACCESS_KEY</code>, <code className="text-emerald-300">AWS_BUCKET_NAME</code> та <code className="text-emerald-300">AWS_REGION</code> зберігаються у файлі <code className="text-white">.env</code> на сервері — не в базі даних.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Вкладка AI */}
        <div className={activeTab === 'ai' ? 'space-y-6 block' : 'hidden'}>
          <div className="bg-gradient-to-r from-sky-500/10 to-indigo-500/10 border border-sky-500/20 p-6 rounded-2xl shadow-[0_0_30px_rgba(14,165,233,0.1)]">
            <h3 className="text-lg font-bold text-sky-400 mb-4 border-b border-sky-500/20 pb-2 flex items-center gap-2">
              <span>✨</span> AI Модуль: Обробка фотографій та Текстів
            </h3>
            
            {/* Photoroom Section */}
            <div className="mb-8">
               <h4 className="font-semibold text-white mb-2">Photoroom API (Видалення фону)</h4>
               <div className="p-4 bg-sky-500/10 border border-sky-500/30 rounded-xl mb-4 flex items-start gap-3">
                 <span className="text-2xl">🔒</span>
                 <div>
                   <p className="font-bold text-sky-400 text-sm mb-1">Ключі Photoroom захищені в .env</p>
                   <p className="text-xs text-neutral-400">Налаштуйте <code className="text-sky-300">PHOTOROOM_SANDBOX_KEY</code>, <code className="text-sky-300">PHOTOROOM_LIVE_KEY</code> та <code className="text-sky-300">PHOTOROOM_ENVIRONMENT</code> у файлі <code className="text-white">.env</code> на сервері. Не вводьте їх у форму.</p>
                 </div>
               </div>
            </div>

            <div className="border-t border-sky-500/20 pt-6">
               <h4 className="font-semibold text-white mb-2">Креативний Копірайтинг (Anthropic Claude)</h4>
               <div className="grid md:grid-cols-2 gap-4 mb-8 max-w-4xl">
                   <div className="col-span-2 md:col-span-1">
                     <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl flex items-start gap-3">
                       <span className="text-2xl">🔒</span>
                       <div>
                         <p className="font-bold text-orange-400 text-sm mb-1">Ключ Anthropic захищений в .env</p>
                         <p className="text-xs text-neutral-400">Налаштуйте <code className="text-orange-300">ANTHROPIC_API_KEY</code> у файлі <code className="text-white">.env</code> на сервері.</p>
                       </div>
                     </div>
                   </div>
                   <div>
                       <label className="block text-sm text-neutral-300 mb-1">AI Модель для генерації текстів</label>
                       <select name="anthropicModel" defaultValue={settings.anthropicModel || 'claude-sonnet-4-6'} className="w-full bg-[#0a0a0a] border border-orange-500/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-400 text-sm">
                         <optgroup label="Claude Sonnet (Оптимально)">
                           <option value="claude-sonnet-4-6">Claude Sonnet 4-6 (Рекомендовано)</option>
                           <option value="claude-sonnet-4-5">Claude Sonnet 4-5</option>
                           <option value="claude-sonnet-4">Claude Sonnet 4</option>
                         </optgroup>
                         <optgroup label="Claude Opus (Більш потужні)">
                           <option value="claude-opus-4-7">Claude Opus 4-7</option>
                           <option value="claude-opus-4-6">Claude Opus 4-6</option>
                           <option value="claude-opus-4-5">Claude Opus 4-5</option>
                           <option value="claude-opus-4-1">Claude Opus 4-1</option>
                           <option value="claude-opus-4">Claude Opus 4</option>
                         </optgroup>
                       </select>
                   </div>
               </div>

               <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-white">Керування Промптами (Теми Описів)</h4>
                  <button type="button" onClick={() => { setEditingPrompt(null); setIsPromptModalOpen(true); }} className="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                    + Додати Промпт
                  </button>
               </div>
            </div>
          </div>
        </div>

        {/* Вкладка SMM */}
        <div className={activeTab === 'smm' ? 'space-y-6 block' : 'hidden'}>
          <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/20 p-6 rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.1)]">
            <h3 className="text-lg font-bold text-violet-400 mb-4 border-b border-violet-500/20 pb-2 flex items-center gap-2">
              <span>📱</span> SMM Автоматизація (Instagram / Facebook)
            </h3>
            
            <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Social Accounts */}
            <div>
               <div className="flex justify-between items-center mb-4">
                 <h4 className="font-semibold text-white">Акаунти Соцмереж</h4>
                 <button type="button" onClick={() => setIsSocialModalOpen(true)} className="bg-violet-500 hover:bg-violet-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                   + Додати Акаунт
                 </button>
               </div>
               <div className="bg-black/50 border border-white/10 rounded-xl overflow-hidden">
                 <table className="w-full text-left text-sm text-neutral-300">
                   <thead className="bg-white/5 border-b border-white/10 text-xs">
                     <tr>
                       <th className="p-3">Назва</th>
                       <th className="p-3">Платформа</th>
                       <th className="p-3 text-right">Дії</th>
                     </tr>
                   </thead>
                   <tbody>
                     {socialAccounts.map((sa: any) => (
                       <tr key={sa.id} className="border-b border-white/5 hover:bg-white/5">
                         <td className="p-3 font-bold text-white">{sa.name}</td>
                         <td className="p-3 text-violet-400 font-mono text-xs">{sa.platform}</td>
                         <td className="p-3 text-right">
                            <button type="button" onClick={() => setDeletingSocial(sa)} className="text-rose-400 hover:text-rose-300 text-xs">Видалити</button>
                         </td>
                       </tr>
                     ))}
                     {socialAccounts.length === 0 && (
                       <tr><td colSpan={3} className="p-4 text-center text-neutral-500 text-xs">Немає доданих акаунтів</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* Auto Approve */}
            <div>
               <h4 className="font-semibold text-white mb-2">Авто-апрув (Публікувати без перевірки)</h4>
               <p className="text-xs text-neutral-400 mb-4">Якщо увімкнено, згенерований контент одразу потрапляє в чергу на публікацію за розкладом, минаючи статус "Draft".</p>
               
               <div className="space-y-3 bg-black/30 p-4 rounded-xl border border-white/5">
                 <label className="flex items-center gap-3 cursor-pointer group">
                   <input type="checkbox" name="autoApproveFbPost" defaultChecked={settings.autoApproveFbPost} className="w-5 h-5 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500 focus:ring-offset-0" />
                   <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">Facebook Posts (Фото/Карусель)</span>
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer group">
                   <input type="checkbox" name="autoApproveInstaPost" defaultChecked={settings.autoApproveInstaPost} className="w-5 h-5 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500 focus:ring-offset-0" />
                   <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">Instagram Posts (Фото/Карусель)</span>
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer group">
                   <input type="checkbox" name="autoApproveInstaReels" defaultChecked={settings.autoApproveInstaReels} className="w-5 h-5 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500 focus:ring-offset-0" />
                   <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">Instagram Reels (Відео)</span>
                 </label>
               </div>
            </div>
          </div>
        </div>
      </div>

        <div className="flex justify-end sticky bottom-4 z-40">
          <button disabled={loading} type="submit" className="px-8 py-4 bg-white text-black text-lg font-black rounded-2xl hover:bg-neutral-200 hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]">
            {loading ? 'Збереження...' : 'Зберегти Налаштування'}
          </button>
        </div>
      </form>

     {/* ROULETTE CONSTRUCTOR MODAL */}
      {isRouletteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-[#111] border border-indigo-500/30 rounded-[30px] p-8 shadow-[0_0_100px_rgba(99,102,241,0.2)] w-full max-w-md">
              <h3 className="text-2xl font-black mb-2 text-white">Конструктор Рулетки 🎰</h3>
              <p className="text-sm text-neutral-400 mb-6">Встановіть ймовірності випадання кожної знижки. Сума всіх полів повинна дорівнювати 100%.</p>

              <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto pr-2">
                {slices.map((slice, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-black/50 border border-white/10 rounded-2xl gap-4">
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-400">Знижка:</span>
                        <input 
                          type="number" min="1" max="100"
                          value={slice.discount} 
                          onChange={(e) => handleUpdateSlice(idx, 'discount', e.target.value)}
                          className="w-16 bg-white/10 text-white font-bold border border-white/20 rounded-xl px-2 py-2 text-center outline-none" 
                        />
                        <span className="text-neutral-400 font-bold">%</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-neutral-400">Шанс:</span>
                        <input 
                          type="number" min="0" max="100"
                          value={slice.chance} 
                          onChange={(e) => handleUpdateSlice(idx, 'chance', e.target.value)}
                          className="w-16 bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/50 rounded-xl px-2 py-2 text-center outline-none" 
                        />
                        <span className="text-neutral-500 font-bold">%</span>
                     </div>
                     <button type="button" onClick={() => handleRemoveSlice(idx)} className="text-rose-500 hover:text-rose-400 p-2 opacity-70 hover:opacity-100 transition-opacity" title="Видалити">
                       ✕
                     </button>
                  </div>
                ))}
              </div>
              
              <button type="button" onClick={handleAddSlice} className="w-full bg-white/5 border border-white/10 border-dashed rounded-xl py-3 text-sm font-bold text-neutral-400 mb-6 hover:bg-white/10 transition-colors">
                 + Додати Знижку
              </button>

              <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl mb-8">
                 <span className="font-bold">Разом:</span>
                 <span className={`text-2xl font-black ${totalChance === 100 ? 'text-emerald-400' : 'text-rose-500'}`}>
                   {totalChance}%
                 </span>
              </div>

              <div className="flex gap-4">
                 <button onClick={() => setIsRouletteOpen(false)} type="button" className="flex-1 bg-white/10 font-bold rounded-xl py-4 hover:bg-white/20 transition-colors">
                   Закрити
                 </button>
                 <button 
                   onClick={() => setIsRouletteOpen(false)} 
                   disabled={totalChance !== 100}
                   type="button" 
                   className="flex-1 bg-indigo-500 text-white font-bold rounded-xl py-4 disabled:opacity-30 disabled:scale-100 hover:bg-indigo-400 transform active:scale-95 transition-all text-sm"
                   title="Зберегти конфігурацію (в оперативну пам'ять, необхідно натиснути Зберегти Налаштування)"
                 >
                   Прийняти
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* PROMPT CONSTRUCTOR MODAL */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-[#111] border border-sky-500/30 rounded-2xl p-6 shadow-2xl w-full max-w-xl">
              <h3 className="text-xl font-bold mb-4 text-white">{editingPrompt ? 'Редагувати Промпт' : 'Новий Промпт'}</h3>
              
              <form onSubmit={handleSavePrompt} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Назва (Тема)</label>
                  <input name="name" required defaultValue={editingPrompt?.name || ''} placeholder="Напр. Дитячий" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Контент Промпту (Claude отримає цей текст)</label>
                  <textarea name="content" required rows={6} defaultValue={editingPrompt?.content || ''} placeholder="Ти експерт..." className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" />
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button type="button" onClick={() => setIsPromptModalOpen(false)} className="flex-1 bg-white/5 py-3 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
                  <button type="submit" disabled={loading} className="flex-1 bg-sky-500 text-white py-3 rounded-lg text-sm font-bold hover:bg-sky-400 transition-colors">
                    {loading ? 'Збереження...' : 'Зберегти Промпт'}
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}

      {deletingPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
             <h3 className="text-lg font-bold text-rose-400 mb-2">Видалення промпту</h3>
             <p className="text-sm text-neutral-400 mb-6">Ви дійсно хочете видалити промпт <b>{deletingPrompt.name}</b>?</p>
             <div className="flex gap-3">
               <button onClick={() => setDeletingPrompt(null)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
               <button onClick={executeDeletePrompt} disabled={loading} className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-rose-400 transition-colors">
                 {loading ? '...' : 'Видалити'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* SOCIAL ACCOUNT MODALS */}
      {isSocialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-[#111] border border-violet-500/30 rounded-2xl p-6 shadow-2xl w-full max-w-sm">
              <h3 className="text-xl font-bold mb-4 text-white">Додати Акаунт</h3>
              
              <form onSubmit={handleSaveSocial} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Назва Сторінки (для себе)</label>
                  <input name="name" required placeholder="Напр. DrukHouse FB" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Платформа</label>
                  <select name="platform" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none">
                    <option value="FACEBOOK">Facebook</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="TIKTOK">TikTok</option>
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4 border-t border-white/10">
                  <button type="button" onClick={() => setIsSocialModalOpen(false)} className="flex-1 bg-white/5 py-3 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
                  <button type="submit" disabled={loading} className="flex-1 bg-violet-500 text-white py-3 rounded-lg text-sm font-bold hover:bg-violet-400 transition-colors">
                    {loading ? '...' : 'Зберегти'}
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}

      {deletingSocial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
             <h3 className="text-lg font-bold text-rose-400 mb-2">Видалення Акаунту</h3>
             <p className="text-sm text-neutral-400 mb-6">Ви дійсно хочете видалити акаунт <b>{deletingSocial.name}</b>?</p>
             <div className="flex gap-3">
               <button onClick={() => setDeletingSocial(null)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
               <button onClick={executeDeleteSocial} disabled={loading} className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-rose-400 transition-colors">
                 {loading ? '...' : 'Видалити'}
               </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
