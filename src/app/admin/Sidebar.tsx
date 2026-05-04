'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/LogoutButton';

export default function Sidebar({ permissions = [], siteName = 'Telegram Store' }: { permissions?: string[], siteName?: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [time, setTime] = useState<Date | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // If user has VIEW_ALL, they can at least see the link (even if read-only inside)
  const can = (perm: string) => permissions.includes(perm) || permissions.includes('VIEW_ALL');

  const navLinks = [
    { href: '/admin',            name: 'Статистика (Головна)', icon: '📊', show: true },
    { href: '/admin/orders',     name: 'Замовлення',           icon: '🛍', show: can('MANAGE_ORDERS') },
    { href: '/admin/carts',      name: 'Кинуті Кошики',       icon: '🛒', show: can('MANAGE_ORDERS') },
    { href: '/admin/products',   name: 'Товари',               icon: '📦', show: can('MANAGE_PRODUCTS') },
    { href: '/admin/categories', name: 'Категорії',            icon: '🗂', show: can('MANAGE_CATEGORIES') },
    { href: '/admin/smm',        name: 'SMM Пости',            icon: '📱', show: can('MANAGE_PRODUCTS') || can('MANAGE_SETTINGS') },
    { href: '/admin/customers',  name: 'Клієнти',              icon: '🫂', show: can('MANAGE_USERS') },
    { href: '/admin/users',      name: 'Персонал (Ролі)',      icon: '🛡', show: can('MANAGE_RBAC') },
    { href: '/admin/settings',   name: 'Налаштування',         icon: '⚙️', show: can('MANAGE_SETTINGS') },
    { href: '/admin/license',    name: 'Ліцензія (PRO)',       icon: '🔑', show: can('MANAGE_SETTINGS') },
    { href: '/admin/support',    name: 'Підтримати автора',    icon: '☕', show: true },
  ].filter(l => l.show);

  return (
    <aside 
      className={`${isCollapsed ? 'w-20' : 'w-64'} bg-black/50 border-r border-white/10 backdrop-blur-md flex flex-col transition-all duration-300 relative z-20`}
    >
      {/* Toggle Button */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-lg hover:bg-indigo-400 transition-colors z-30"
      >
        {isCollapsed ? '›' : '‹'}
      </button>

      <div className={`p-6 transition-all duration-300 ${isCollapsed ? 'items-center justify-center flex p-4' : ''}`}>
        {isCollapsed ? (
          <h2 className="text-2xl font-black bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">A</h2>
        ) : (
          <>
            <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent leading-tight">
              {siteName}
            </h2>
            <p className="text-[10px] text-neutral-500 mt-1 uppercase tracking-widest">Admin Panel</p>
          </>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link 
              key={link.href}
              href={link.href} 
              className={`block px-4 py-3 text-sm rounded-xl font-medium transition-all flex items-center gap-3 whitespace-nowrap ${
                isActive 
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' 
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
            >
              <span className="text-lg">{link.icon}</span>
              {!isCollapsed && <span>{link.name}</span>}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-white/10 space-y-4">
        {/* System Online & Clock */}
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'justify-between px-2'}`}>
          <Link href="/admin/health" className="flex items-center gap-2 group" title="Стан Системи">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"></span>
            {!isCollapsed && <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300">Онлайн</span>}
          </Link>
          {!isCollapsed && (
            <div className="text-xs font-mono text-neutral-400 font-bold bg-white/5 py-1 px-2 rounded-lg border border-white/5">
              {time ? time.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
            </div>
          )}
        </div>

        {/* Current User & Logout */}
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center flex-col gap-4' : 'px-2'}`}>
          {!isCollapsed && (
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">Керування</p>
              <p className="text-[10px] text-neutral-500">TG Store Bot</p>
            </div>
          )}
          <LogoutButton isCollapsed={isCollapsed} />
        </div>
      </div>
    </aside>
  );
}
