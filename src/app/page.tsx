import prisma from '@/lib/prisma';
import StorefrontClient from '@/components/StorefrontClient';
import { StoreProvider } from '@/components/StoreProvider';

export const dynamic = 'force-dynamic';

export default async function Storefront(props: { searchParams: Promise<{ error?: string }> }) {
  const products = await prisma.product.findMany({
    where: { status: { in: ['IN_STOCK', 'MADE_TO_ORDER'] } }, // Show in-stock and made-to-order
    include: { category: true }
  });
  
  const categories = await prisma.category.findMany();
  
  const searchParams = await props.searchParams;
  const isForbidden = searchParams?.error === 'forbidden';
  
  const settings = await prisma.settings.findFirst();
  const defaultSlices = [
    { discount: 10, chance: 50 },
    { discount: 25, chance: 30 },
    { discount: 50, chance: 15 },
    { discount: 75, chance: 5 }
  ];
  let rouletteSlices = defaultSlices;
  if (settings?.rouletteWinChances) {
    if (typeof settings.rouletteWinChances === 'string') {
      try { rouletteSlices = JSON.parse(settings.rouletteWinChances); } catch(e){}
    } else if (Array.isArray(settings.rouletteWinChances)) {
      rouletteSlices = settings.rouletteWinChances as any;
    }
  }

  return (
    <StoreProvider>
      <StorefrontClient 
        products={JSON.parse(JSON.stringify(products))} 
        categories={JSON.parse(JSON.stringify(categories))} 
        isForbidden={isForbidden}
        rouletteSlices={rouletteSlices}
      />
    </StoreProvider>
  );
}
