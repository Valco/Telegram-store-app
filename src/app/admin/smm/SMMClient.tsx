'use client';

import { useState } from 'react';
import { updatePostStatus, updatePostText, deletePost, massDeletePosts, massApprovePosts, regeneratePostText, regeneratePostMedia } from './actions';
import Image from 'next/image';

export default function SMMClient({ initialPosts }: { initialPosts: any[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewPost, setPreviewPost] = useState<any>(null);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());

  const handleSort = (key: string) => {
    let direction: 'asc'|'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sorted = [...posts].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      
      // Handle nested
      if (key === 'productName') { aVal = a.product?.name; bVal = b.product?.name; }
      if (key === 'accountName') { aVal = a.account?.name; bVal = b.account?.name; }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setPosts(sorted);
  };

  const getSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const handleStatusChange = async (id: string, newStatus: any) => {
    setLoading(true);
    await updatePostStatus(id, newStatus);
    setPosts(posts.map(p => p.id === id ? { ...p, status: newStatus } : p));
    if (previewPost?.id === id) setPreviewPost({ ...previewPost, status: newStatus });
    setLoading(false);
  };

  const handleTextSave = async (id: string, newText: string) => {
    setLoading(true);
    await updatePostText(id, newText);
    setPosts(posts.map(p => p.id === id ? { ...p, textContent: newText } : p));
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Видалити пост?')) return;
    setLoading(true);
    await deletePost(id);
    setPosts(posts.filter(p => p.id !== id));
    setPreviewPost(null);
    setLoading(false);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedPosts);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedPosts(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedPosts.size === posts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(posts.map(p => p.id)));
    }
  };

  const handleMassDelete = async () => {
    if (selectedPosts.size === 0) return;
    if (!confirm(`Видалити обрані пости (${selectedPosts.size} шт)?`)) return;
    setLoading(true);
    const arr = Array.from(selectedPosts);
    await massDeletePosts(arr);
    setPosts(posts.filter(p => !selectedPosts.has(p.id)));
    setSelectedPosts(new Set());
    setLoading(false);
  };

  const handleMassApprove = async () => {
    if (selectedPosts.size === 0) return;
    if (!confirm(`Схвалити обрані пости (${selectedPosts.size} шт)?`)) return;
    setLoading(true);
    const arr = Array.from(selectedPosts);
    await massApprovePosts(arr);
    setPosts(posts.map(p => selectedPosts.has(p.id) ? { ...p, status: 'APPROVED' } : p));
    setSelectedPosts(new Set());
    setLoading(false);
  };

  const handleRegenerateText = async (id: string) => {
    setLoading(true);
    const res = await regeneratePostText(id);
    if (res.success && res.textContent) {
      setPosts(posts.map(p => p.id === id ? { ...p, textContent: res.textContent } : p));
      if (previewPost?.id === id) setPreviewPost({ ...previewPost, textContent: res.textContent });
    } else {
      alert(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const handleRegenerateMedia = async (id: string) => {
    setLoading(true);
    const res = await regeneratePostMedia(id);
    if (res.success && res.mediaUrls) {
      setPosts(posts.map(p => p.id === id ? { ...p, mediaUrls: res.mediaUrls, photoroomPrompt: res.promptUsed || p.photoroomPrompt } : p));
      if (previewPost?.id === id) setPreviewPost({ ...previewPost, mediaUrls: res.mediaUrls, photoroomPrompt: res.promptUsed || previewPost.photoroomPrompt });
    } else {
      alert(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const statusColors: any = {
    GENERATING: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
    DRAFT: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/50',
    APPROVED: 'bg-sky-500/20 text-sky-400 border-sky-500/50',
    PUBLISHED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
    FAILED: 'bg-rose-500/20 text-rose-400 border-rose-500/50',
  };

  return (
    <div className="animate-in fade-in duration-500 relative">
       
       {selectedPosts.size > 0 && (
         <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-between animate-in slide-in-from-top-4">
           <div className="text-sm font-bold text-indigo-300">
             Обрано постів: {selectedPosts.size}
           </div>
           <div className="flex gap-3">
             <button disabled={loading} onClick={handleMassApprove} className="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
               ✅ Схвалити обрані
             </button>
             <button disabled={loading} onClick={handleMassDelete} className="bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
               🗑 Видалити обрані
             </button>
           </div>
         </div>
       )}

       <div className="bg-[#111] border border-white/10 rounded-2xl overflow-x-auto shadow-2xl">
          <table className="w-full text-left text-sm text-neutral-300">
             <thead className="bg-white/5 border-b border-white/10 uppercase text-xs font-bold">
               <tr>
                 <th className="p-4 w-12 text-center">
                   <input type="checkbox" onChange={toggleSelectAll} checked={posts.length > 0 && selectedPosts.size === posts.length} className="w-4 h-4 rounded border-white/20 bg-black" />
                 </th>
                 <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('createdAt')}>Дата {getSortIcon('createdAt')}</th>
                 <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('productName')}>Товар {getSortIcon('productName')}</th>
                 <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('platform')}>Платформа {getSortIcon('platform')}</th>
                 <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('mediaType')}>Тип {getSortIcon('mediaType')}</th>
                 <th className="p-4 cursor-pointer hover:bg-white/5" onClick={() => handleSort('status')}>Статус {getSortIcon('status')}</th>
                 <th className="p-4 text-right">Дії</th>
               </tr>
             </thead>
             <tbody>
               {posts.map(post => (
                 <tr key={post.id} className={`border-b border-white/5 transition-colors ${selectedPosts.has(post.id) ? 'bg-indigo-500/5 hover:bg-indigo-500/10' : 'hover:bg-white/5'}`}>
                   <td className="p-4 text-center">
                     <input type="checkbox" checked={selectedPosts.has(post.id)} onChange={() => toggleSelect(post.id)} className="w-4 h-4 rounded border-white/20 bg-black" />
                   </td>
                   <td className="p-4 whitespace-nowrap text-xs text-neutral-500">{new Date(post.createdAt).toLocaleString('uk')}</td>
                   <td className="p-4 font-bold text-white max-w-[200px] truncate" title={post.product?.name}>
                      {post.product?.name}
                   </td>
                   <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${post.platform === 'INSTAGRAM' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {post.platform}
                      </span>
                      <div className="text-[10px] text-neutral-500 mt-1">{post.account?.name}</div>
                   </td>
                   <td className="p-4">
                      <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded">{post.mediaType}</span>
                   </td>
                   <td className="p-4">
                      <span className={`px-2 py-1 border rounded-lg text-xs font-bold ${statusColors[post.status] || ''}`}>
                        {post.status}
                      </span>
                   </td>
                   <td className="p-4 text-right">
                      <button onClick={() => setPreviewPost(post)} className="bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 px-3 py-1.5 rounded-lg font-bold transition-colors">
                        Відкрити
                      </button>
                   </td>
                 </tr>
               ))}
               {posts.length === 0 && (
                 <tr><td colSpan={6} className="p-8 text-center text-neutral-500">Постів ще немає. Вони будуть згенеровані при додаванні нових товарів.</td></tr>
               )}
             </tbody>
          </table>
       </div>

       {/* PREVIEW MODAL */}
       {previewPost && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
           <div className="bg-[#111] border border-indigo-500/30 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
              
              {/* Media Side */}
              <div className="w-full md:w-1/2 bg-black flex flex-col items-center justify-center p-4 relative min-h-[300px]">
                 {previewPost.mediaType === 'REELS' ? (
                   <video src={previewPost.mediaUrls[0]} controls className="max-h-full max-w-full rounded-lg" autoPlay loop muted />
                 ) : (
                   <img src={previewPost.mediaUrls[0]} alt="Post Media" className="max-h-full max-w-full object-contain rounded-lg" />
                 )}
                 <div className="absolute top-4 left-4 flex flex-col gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black shadow-lg ${previewPost.platform === 'INSTAGRAM' ? 'bg-fuchsia-500 text-white' : 'bg-blue-600 text-white'}`}>
                      {previewPost.platform}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/80 text-white shadow-lg border border-white/20">
                      {previewPost.mediaType}
                    </span>
                 </div>
                 <button disabled={loading} onClick={() => handleRegenerateMedia(previewPost.id)} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-bold border border-white/20 transition-colors whitespace-nowrap">
                   {loading ? '⏳' : '🔄'} Перегенерувати {previewPost.mediaType === 'REELS' ? 'Відео' : 'Фото'}
                 </button>
              </div>

              {/* Info Side */}
              <div className="w-full md:w-1/2 p-6 flex flex-col bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] overflow-y-auto">
                 <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{previewPost.product?.name}</h3>
                      <p className="text-sm text-indigo-400 font-medium">Акаунт: {previewPost.account?.name || 'Невідомо'}</p>
                    </div>
                    <button onClick={() => setPreviewPost(null)} className="text-neutral-500 hover:text-white text-2xl leading-none">×</button>
                 </div>

                 <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-xs text-neutral-400 font-bold uppercase tracking-wide">Статус:</span>
                       <span className={`px-2 py-0.5 border rounded text-xs font-bold ${statusColors[previewPost.status] || ''}`}>
                         {previewPost.status}
                       </span>
                    </div>
                    {previewPost.photoroomPrompt && previewPost.mediaType === 'IMAGE' && (
                       <div className="mt-2 p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                          <span className="text-xs text-indigo-400 font-bold block mb-1">Використаний Photoroom Промпт:</span>
                          <p className="text-xs text-indigo-200 font-bold">{previewPost.photoroomPrompt}</p>
                       </div>
                    )}
                 </div>

                 <div className="flex-1 flex flex-col mb-4">
                    <label className="text-sm font-bold text-neutral-300 mb-2 flex justify-between items-center">
                       Текст Поста:
                       <div className="flex items-center gap-3">
                         <span className="text-xs font-normal text-neutral-500">Можна редагувати</span>
                         <button disabled={loading} onClick={() => handleRegenerateText(previewPost.id)} className="bg-sky-500/20 hover:bg-sky-500/40 text-sky-400 text-xs px-2 py-1 rounded transition-colors">
                           🔄 Перегенерувати
                         </button>
                       </div>
                    </label>
                    <textarea 
                      className="w-full flex-1 min-h-[150px] bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-neutral-200 outline-none focus:border-indigo-500 transition-colors resize-none"
                      value={previewPost.textContent || ''}
                      onChange={(e) => setPreviewPost({ ...previewPost, textContent: e.target.value })}
                    />
                 </div>

                 <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-white/10">
                    <div className="flex gap-3">
                      <button 
                         disabled={loading}
                         onClick={() => handleTextSave(previewPost.id, previewPost.textContent)} 
                         className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl text-sm font-bold transition-colors">
                        💾 Зберегти Текст
                      </button>
                      <button 
                         disabled={loading}
                         onClick={() => handleStatusChange(previewPost.id, 'APPROVED')} 
                         className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-3 rounded-xl text-sm font-black transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                        ✅ Схвалити (Approve)
                      </button>
                    </div>
                    <div className="flex justify-between items-center px-1">
                       <button disabled={loading} onClick={() => handleStatusChange(previewPost.id, 'DRAFT')} className="text-xs text-neutral-400 hover:text-white transition-colors">
                         Повернути в Draft
                       </button>
                       <button disabled={loading} onClick={() => handleDelete(previewPost.id)} className="text-xs text-rose-500 hover:text-rose-400 transition-colors">
                         🗑 Видалити Пост
                       </button>
                    </div>
                 </div>
              </div>
           </div>
         </div>
       )}

    </div>
  );
}
