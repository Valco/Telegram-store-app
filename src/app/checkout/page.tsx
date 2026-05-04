import prisma from '@/lib/prisma';
import CheckoutClient from '@/components/CheckoutClient';
import { StoreProvider } from '@/components/StoreProvider';

export default async function CheckoutPage() {
  const products = await prisma.product.findMany();
  let settings = await prisma.settings.findFirst();
  if (!settings) {
    settings = await prisma.settings.create({ data: { maxCoinsPercent: 15, coinToUahRate: 10 } });
  }

  return (
    <StoreProvider>
      <CheckoutClient 
        products={JSON.parse(JSON.stringify(products))} 
        settings={JSON.parse(JSON.stringify(settings))}
      />
    </StoreProvider>
  );
}
