import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ProductClient from './ProductClient';

import { StoreProvider } from '@/components/StoreProvider';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true }
  });

  if (!product || product.status === 'OUT_OF_STOCK') {
    return (
       <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white p-6 text-center">
         <div className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
           <h2 className="text-2xl font-bold mb-4">На жаль 😔</h2>
           <p className="text-neutral-400">Такий товар не доступний для замовлення...</p>
           <a href="/" className="mt-6 inline-block bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-400 transition">Повернутися на Головну</a>
         </div>
       </div>
    );
  }

  return (
    <StoreProvider>
      <ProductClient product={product} />
    </StoreProvider>
  );
}
