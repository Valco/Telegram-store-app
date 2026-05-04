import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { cookies } from 'next/headers';
import { decryptJWT } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('adminSession')?.value;
  const session = await decryptJWT(sessionCookie);
  const permissions = session?.permissions || [];

  // Load site name from settings
  const settings = await prisma.settings.findFirst({ select: { siteName: true } }).catch(() => null);
  const siteName = settings?.siteName || 'Telegram Store';

  return (
    <div className="flex h-screen bg-neutral-900 text-white font-sans overflow-hidden">
      
      {/* Sidebar (Client Component) */}
      <Sidebar permissions={permissions} siteName={siteName} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-[#0a0a0a] relative">
        {/* Abstract ambient background glow */}
        <div className="absolute top-0 left-0 w-full h-96 bg-purple-900/10 blur-[120px] pointer-events-none -z-10" />
        
        <header className="sticky top-0 z-10 backdrop-blur-xl bg-[#0a0a0a]/80 border-b border-white/5 px-8 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white/90">Панель Управління — {siteName}</h1>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
