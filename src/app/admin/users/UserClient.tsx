'use client';

import { useState } from 'react';
import { createRole, deleteRole, updateRole, createStaffAccount, deleteStaffAccount, updateStaffAccount } from './actions';

const PERMISSIONS_LIST = [
  { id: 'MANAGE_ORDERS', name: 'Замовлення', desc: 'Перегляд та редагування замовлень' },
  { id: 'MANAGE_PRODUCTS', name: 'Товари', desc: 'Створення та редагування товарів' },
  { id: 'MANAGE_CATEGORIES', name: 'Категорії', desc: 'Створення та редагування категорій' },
  { id: 'MANAGE_USERS', name: 'Клієнти', desc: 'Керування клієнтами та відгуками' },
  { id: 'MANAGE_RBAC', name: 'Персонал (Ролі)', desc: 'Керування доступом співробітників' },
  { id: 'MANAGE_SETTINGS', name: 'Налаштування', desc: 'Глобальні налаштування магазину та лояльності' },
  { id: 'VIEW_ALL', name: 'Тільки перегляд', desc: 'Загальний доступ без права редагування' }
];

export default function UserClient({ roles, staff }: { roles: any[], staff: any[] }) {
  const [activeTab, setActiveTab] = useState<'ROLES' | 'STAFF'>('STAFF');
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  
  const [isStaffOpen, setIsStaffOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  const [deletingRole, setDeletingRole] = useState<any>(null);
  const [deletingStaff, setDeletingStaff] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSaveRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = selectedRole 
      ? await updateRole(selectedRole.id, new FormData(e.currentTarget))
      : await createRole(new FormData(e.currentTarget));
      
    if (res.success) {
      setIsRoleOpen(false);
      setSelectedRole(null);
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const handleSaveStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true); setError('');
    const res = selectedStaff
      ? await updateStaffAccount(selectedStaff.id, new FormData(e.currentTarget))
      : await createStaffAccount(new FormData(e.currentTarget));
      
    if (res.success) {
      setIsStaffOpen(false);
      setSelectedStaff(null);
    } else {
      setError(res.error || 'Помилка');
    }
    setLoading(false);
  };

  const executeDeleteRole = async () => {
    if (!deletingRole) return;
    setLoading(true);
    const res = await deleteRole(deletingRole.id);
    if (!res.success) alert(res.error);
    else setDeletingRole(null);
    setLoading(false);
  };

  const executeDeleteStaff = async () => {
    if (!deletingStaff) return;
    setLoading(true);
    const res = await deleteStaffAccount(deletingStaff.id);
    if (!res.success) alert(res.error);
    else setDeletingStaff(null);
    setLoading(false);
  };

  return (
    <>
      <div className="flex justify-between items-center bg-white/5 border border-white/10 p-6 rounded-2xl mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Управління Доступом</h2>
          <p className="text-sm text-neutral-400">Керування персоналом та налаштування їх можливостей.</p>
        </div>
        <div className="flex gap-2 bg-black/40 p-1 rounded-xl">
          <button onClick={() => setActiveTab('STAFF')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'STAFF' ? 'bg-indigo-500 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}>Персонал</button>
          <button onClick={() => setActiveTab('ROLES')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'ROLES' ? 'bg-indigo-500 text-white shadow-lg' : 'text-neutral-400 hover:text-white'}`}>Ролі</button>
        </div>
      </div>

      {activeTab === 'ROLES' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="flex justify-between mb-4">
             <h3 className="text-lg font-bold">Таблиця Ролей</h3>
             <button onClick={() => { setSelectedRole(null); setIsRoleOpen(true); }} className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 hover:bg-white/20 transition-colors">+ Створити Роль</button>
           </div>
           <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
             <table className="w-full text-left text-sm text-neutral-400">
               <thead className="bg-white/5 text-neutral-300 text-xs uppercase tracking-wider border-b border-white/10">
                 <tr>
                   <th className="px-6 py-4 font-semibold">Назва Ролі</th>
                   <th className="px-6 py-4 font-semibold">Права</th>
                   <th className="px-6 py-4 font-semibold text-center">Працівників</th>
                   <th className="px-6 py-4 font-semibold text-right">Дії</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 {roles.map((r) => (
                   <tr key={r.id} className="hover:bg-white/5 transition-colors">
                     <td className="px-6 py-4 text-white font-bold">{r.name}</td>
                     <td className="px-6 py-4">
                       <div className="flex flex-wrap gap-2">
                         {r.permissions.map((perm: string) => (
                           <span key={perm} className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded">{perm}</span>
                         ))}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-center text-white font-bold">{r._count?.users || 0}</td>
                     <td className="px-6 py-4 text-right space-x-3">
                       <button onClick={() => { setSelectedRole(r); setIsRoleOpen(true); }} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Редагувати</button>
                       <button onClick={() => setDeletingRole(r)} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">Видалити</button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="flex justify-between mb-4">
             <h3 className="text-lg font-bold">Активні Акаунти</h3>
             <button onClick={() => { setSelectedStaff(null); setIsStaffOpen(true); }} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-400 transition-colors">+ Додати Співробітника</button>
           </div>
           <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
             <table className="w-full text-left text-sm text-neutral-400">
               <thead className="bg-white/5 text-neutral-300 text-xs uppercase tracking-wider border-b border-white/10">
                 <tr>
                   <th className="px-6 py-4 font-semibold">Email</th>
                   <th className="px-6 py-4 font-semibold">Призначена Роль</th>
                   <th className="px-6 py-4 font-semibold">Безпека</th>
                   <th className="px-6 py-4 font-semibold text-right">Статус</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 {staff.map((s) => (
                   <tr key={s.id} className="hover:bg-white/5 transition-colors">
                     <td className="px-6 py-4 text-white font-bold">{s.email || 'Без email'}</td>
                     <td className="px-6 py-4 text-indigo-400 font-medium">{s.accessGroup?.name || 'Невідомо'}</td>
                     <td className="px-6 py-4">
                       {s.requiresOtp ? <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 border border-amber-500/30 rounded">Увімкнено OTP</span> : <span className="text-xs text-neutral-500">Логін + Пароль</span>}
                     </td>
                     <td className="px-6 py-4 text-right space-x-3">
                       <button onClick={() => { setSelectedStaff(s); setIsStaffOpen(true); }} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Редагувати</button>
                       <button onClick={() => setDeletingStaff(s)} className="text-xs text-rose-400 hover:text-rose-300 transition-colors">Видалити</button>
                     </td>
                   </tr>
                 ))}
                 {staff.length === 0 && (
                   <tr><td colSpan={4} className="px-6 py-10 text-center">Поки немає співробітників</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {isRoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4">{selectedRole ? 'Редагувати Роль' : 'Нова Роль'}</h3>
            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Назва Ролі</label>
                <input name="name" defaultValue={selectedRole?.name} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3">
                <span className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">Права доступу:</span>
                {PERMISSIONS_LIST.map((perm) => (
                  <label key={perm.id} className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" name={`permission_${perm.id}`} defaultChecked={selectedRole?.permissions?.includes(perm.id)} className="w-5 h-5 accent-indigo-500 cursor-pointer" />
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">{perm.name}</div>
                      <div className="text-[10px] text-neutral-500">{perm.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              {error && <div className="text-rose-400 text-xs">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsRoleOpen(false)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
                <button type="submit" disabled={loading} className="flex-1 bg-indigo-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-400 transition-colors">Зберегти</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">{selectedStaff ? 'Редагувати Співробітника' : 'Дані Співробітника'}</h3>
            <form onSubmit={handleSaveStaff} className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Email для входу</label>
                <input name="email" type="email" defaultValue={selectedStaff?.email} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Пароль {!selectedStaff && '(скопіюйте та відправте менеджеру)'} {selectedStaff && '(залиште порожнім, щоб не змінювати)'}</label>
                <input name="password" type="text" defaultValue={!selectedStaff ? Math.random().toString(36).substring(2, 10) : ''} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 font-mono text-emerald-400 outline-none" required={!selectedStaff} />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Оберіть Роль</label>
                <select name="accessGroupId" defaultValue={selectedStaff?.accessGroupId} className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white outline-none" required>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="bg-white/5 p-4 rounded-xl border border-amber-500/30">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="requiresOtp" defaultChecked={selectedStaff ? selectedStaff.requiresOtp : true} className="w-5 h-5 accent-amber-500 cursor-pointer" />
                  <div>
                    <div className="text-sm text-amber-500 font-bold">2FA: Вимагати Код OTP</div>
                    <div className="text-xs text-neutral-500">Система вимагатиме 6-значний код для логіна</div>
                  </div>
                </label>
              </div>
              {error && <div className="text-rose-400 text-xs">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsStaffOpen(false)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
                <button type="submit" disabled={loading} className="flex-1 bg-emerald-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors">Зберегти</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
             <h3 className="text-lg font-bold text-rose-400 mb-2">Видалення ролі</h3>
             <p className="text-sm text-neutral-400 mb-6">Безповоротно видалити групу <b>{deletingRole.name}</b>?</p>
             <div className="flex gap-3">
               <button onClick={() => setDeletingRole(null)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
               <button onClick={executeDeleteRole} disabled={loading} className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-rose-400 transition-colors">
                 {loading ? '...' : 'Видалити'}
               </button>
             </div>
          </div>
        </div>
      )}

      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
             <h3 className="text-lg font-bold text-rose-400 mb-2">Видалення доступу</h3>
             <p className="text-sm text-neutral-400 mb-6">Вилучити доступ у <b>{deletingStaff.email || deletingStaff.id}</b>?</p>
             <div className="flex gap-3">
               <button onClick={() => setDeletingStaff(null)} className="flex-1 bg-white/5 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">Скасувати</button>
               <button onClick={executeDeleteStaff} disabled={loading} className="flex-1 bg-rose-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-rose-400 transition-colors">
                 {loading ? '...' : 'Видалити'}
               </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
}
