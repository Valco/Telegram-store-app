import prisma from '@/lib/prisma';
import ProductClient from './ProductClient';
import { getPrompts } from '../settings/promptActions';
import { cookies } from 'next/headers';

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: 'desc' }
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });
  
  const promptResponse = await getPrompts();
  const prompts = promptResponse.data || [];

  const safeProducts = JSON.parse(JSON.stringify(products));
  const safeCategories = JSON.parse(JSON.stringify(categories));
  const safePrompts = JSON.parse(JSON.stringify(prompts));
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('adminSession')?.value;
  const { decryptJWT } = await import('@/lib/auth');
  const session = await decryptJWT(sessionCookie);
  const isAdmin = session?.permissions?.includes('VIEW_ALL') || session?.permissions?.includes('MANAGE_SETTINGS');

  return (
    <div className="animate-in fade-in duration-500">
      <ProductClient 
        products={safeProducts} 
        categories={safeCategories} 
        initialPrompts={safePrompts} 
        isAdmin={isAdmin}
      />
    </div>
  );
}
