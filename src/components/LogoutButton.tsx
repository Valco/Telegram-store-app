'use client';

import { logoutAdmin } from '@/app/admin/login/actions';
import { useState } from 'react';

export default function LogoutButton({ isCollapsed }: { isCollapsed?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await logoutAdmin();
    window.location.href = '/admin/login';
  };

  return (
    <button 
      onClick={handleLogout}
      disabled={loading}
      title="Вийти з акаунту"
      className={`${isCollapsed ? 'px-2 py-2 flex items-center justify-center' : 'ml-4 px-4 py-1.5'} bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-bold hover:bg-red-500 hover:text-white transition-colors`}
    >
      {loading ? (isCollapsed ? '...' : 'Вихід...') : (isCollapsed ? '🚪' : 'Вийти')}
    </button>
  );
}
