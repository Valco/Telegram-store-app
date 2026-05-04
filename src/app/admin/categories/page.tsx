import prisma from '@/lib/prisma';
import CategoryClient from './CategoryClient';

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    include: { parent: true },
    orderBy: { createdAt: 'desc' }
  });

  const safeCategories = JSON.parse(JSON.stringify(categories));

  return (
    <div className="animate-in fade-in duration-500">
      <CategoryClient categories={safeCategories} />
    </div>
  );
}
