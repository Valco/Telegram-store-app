import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Monobank webhook payload reference:
    // https://api.monobank.ua/docs/acquiring.html
    const { invoiceId, status, reference } = data;

    if (!invoiceId) {
      return NextResponse.json({ error: 'No invoice ID provided' }, { status: 400 });
    }

    if (status === 'success') {
      // Find order by exact invoiceId (paymentId) or fallback to reference (orderNumber)
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { paymentId: invoiceId },
            { orderNumber: reference }
          ]
        }
      });

      if (order && order.status !== 'PAID' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED') {
        const updateData: any = { status: 'PAID' };
        
        let awardedCoins = 0;
        
        // Handle Cashback if not yet earned
        if (!order.cashbackEarned) {
          const settings = await prisma.settings.findFirst();
          const cashbackPercent = settings?.cashbackPercent || 0;
          const coinToUahRate = settings?.coinToUahRate || 10;
          
          if (cashbackPercent > 0) {
            awardedCoins = Math.floor((order.finalAmount / 100) * (cashbackPercent / 100) * coinToUahRate);
          }
          
          if (awardedCoins > 0) {
            updateData.cashbackEarned = true;
            
            // Give user coins
            await prisma.user.update({
              where: { id: order.userId },
              data: { coinsBalance: { increment: awardedCoins } }
            });
            
            // Log history
            await prisma.coinsHistory.create({
              data: {
                userId: order.userId,
                amount: awardedCoins,
                reason: `Кешбек за замовлення ${order.orderNumber}`
              }
            });
          }
        }

        await prisma.order.update({
          where: { id: order.id },
          data: updateData
        });
        
        console.log(`[Webhook] Order ${order.orderNumber} successfully paid via Monobank. Cashback awarded: ${awardedCoins} coins.`);
      }
    } else {
      console.log(`[Webhook] Monobank invoice ${invoiceId} status: ${status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Monobank Webhook Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
