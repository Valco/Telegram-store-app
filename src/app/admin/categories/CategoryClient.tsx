'use client';

import { useState } from 'react';
import { createCategory, deleteCategory, updateCategory } from './actions';

export default function CategoryClient({ categories }: { categories: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [deletingCategory, setDeletingCategory] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await createCategory(new FormData(e.currentTarget));
    if (res.success) {
      setIsOpen(false);
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const handleEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await updateCategory(editingCategory.id, new FormData(e.currentTarget));
    if (res.success) {
      setEditingCategory(null);
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const executeDelete = async () => {
    if (!deletingCategory) return;
    setLoading(true);
    const res = await deleteCategory(deletingCategory.id);
    if (!res.success) {
      alert(res.error);
    } else {
      setDeletingCategory(null);
    }
    setLoading(false);
  };

  return (
    <>
      <div className="flex justify-between items-center bg-white/5 border border-white/10 p-6 rounded-2xl mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Категорії Товарів</h2>
          <p className="text-sm text-neutral-400">Управління ієрархією товарних категорій у каталозі.</p>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-400 transition-colors"
        >
          + Додати Категорію
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-sm text-neutral-400">
          <thead className="bg-white/5 text-neutral-300 text-xs uppercase tracking-wider border-b border-white/10">
            <tr>
              <th className="px-6 py-4 font-semibold">Назва (Slug)</th>
              <th className="px-6 py-4 font-semibold">Батьківська Категорія</th>
              <th className="px-6 py-4 font-semibold text-right">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-white font-bold">{c.name}</div>
                  <div className="text-xs text-neutral-500 font-mono mt-1">/{c.slug}</div>
                </td>
                <td className="px-6 py-4">
                  {c.parent ? <span className="text-xs bg-white/10 px-2 py-1 rounded text-white">{c.parent.name}</span> : '-'}
                </td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button 
                    onClick={() => setEditingCategory(c)}
                    className="text-xs text-indigo-400 hover:text-white transition-colors"
                  >
                    Редагувати
                  </button>
                  <button 
                    onClick={() => setDeletingCategory(c)}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Видалити
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Нова Категорія</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Назва</label>
                <input name="name" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Slug (URL)</label>
                <input name="slug" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none font-mono text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Вкласти в (Батьківська)</label>
                <select name="parentId" className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none">
                  <option value="">-- Без батьківської --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              {error && <div className="text-rose-400 text-xs">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsOpen(false)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
                <button type="submit" disabled={loading} className="flex-1 bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-400 transition-colors">
                  {loading ? '...' : 'Зберегти'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Редагування Категорії</h3>
            <form onSubmit={handleEdit} className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Назва</label>
                <input name="name" defaultValue={editingCategory.name} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Slug (URL)</label>
                <input name="slug" defaultValue={editingCategory.slug} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none font-mono text-sm" required />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Вкласти в (Батьківська)</label>
                <select name="parentId" defaultValue={editingCategory.parentId || ''} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none">
                  <option value="">-- Без батьківської --</option>
                  {categories.filter(c => c.id !== editingCategory.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              {error && <div className="text-rose-400 text-xs">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingCategory(null)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
                <button type="submit" disabled={loading} className="flex-1 bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-400 transition-colors">
                  {loading ? '...' : 'Зберегти Зміни'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
             <h3 className="text-lg font-bold text-rose-400 mb-2">Видалення категорії</h3>
             <p className="text-sm text-neutral-400 mb-6">Ви впевнені, що хочете видалити категорію <b>{deletingCategory.name}</b>?</p>
             <div className="flex gap-3">
               <button onClick={() => setDeletingCategory(null)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
               <button onClick={executeDelete} disabled={loading} className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-rose-400 transition-colors">
                 {loading ? '...' : 'Видалити'}
               </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
}
