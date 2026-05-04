import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { publishToTelegram } from '@/app/admin/products/actions';

export const dynamic = 'force-dynamic';

// Next.js Route Handler for Cron Job
// You can ping this endpoint via wget or cron every minute:
// * * * * * curl https://your-domain.com/api/cron/publish > /dev/null 2>&1

export async function GET(request: Request) {
  try {
    const now = new Date();
    
    // Find products that are scheduled to be published, and time has passed, but not yet published
    const pendingProducts = await prisma.product.findMany({
      where: {
        scheduledPublishAt: {
          lte: now,
        },
        isPublished: false, // this indicates it hasn't been posted yet
      },
      take: 10 // batch to avoid TG rate limits
    });

    if (pendingProducts.length === 0) {
      return NextResponse.json({ success: true, message: 'Nothing to publish' });
    }

    const results = [];

    for (const product of pendingProducts) {
      const res = await publishToTelegram(product.id);
      results.push({ id: product.id, name: product.name, success: res.success, error: res.error });
      
      // Artificial delay to respect Telegram limits (1 message per sec is safe)
      await new Promise(r => setTimeout(r, 1000));
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (e: any) {
    console.error('Cron publish error:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
