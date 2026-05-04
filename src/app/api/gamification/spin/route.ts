import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptJWT } from '@/lib/auth';
import { canUseFeature } from '@/lib/license';

export async function POST(request: Request) {
  try {
    // Phase 2: License check
    if (!(await canUseFeature('ROULETTE'))) {
      return NextResponse.json({ error: 'PRO_REQUIRED', feature: 'ROULETTE', upgradeUrl: '/admin/support' }, { status: 403 });
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await decryptJWT(token);
    
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId as string;
    
    // Check if user already spun
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { activeDiscountPercent: true, discountExpiresAt: true }
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const now = new Date();
    
    // Check if 24 hours have passed since last spin
    const lastSpin = await prisma.coinsHistory.findFirst({
      where: { userId: userId, reason: 'roulette_spin' },
      orderBy: { createdAt: 'desc' }
    });

    if (lastSpin && (now.getTime() - lastSpin.createdAt.getTime()) < 24 * 60 * 60 * 1000) {
      return NextResponse.json({ 
        error: 'Рулетку можна крутити лише 1 раз в 24 години!' 
      }, { status: 400 });
    }

    // If they have an active unused discount, deny them
    if (user.activeDiscountPercent !== null && user.discountExpiresAt && user.discountExpiresAt > now) {
      return NextResponse.json({ 
        error: 'У вас вже є активна знижка! Використайте її перед наступним прокрутом.', 
        discount: user.activeDiscountPercent 
      }, { status: 400 });
    }

    const settings = await prisma.settings.findFirst();
    const defaultSlices = [
      { discount: 10, chance: 50 },
      { discount: 25, chance: 30 },
      { discount: 50, chance: 15 },
      { discount: 75, chance: 5 }
    ];
    let slices = defaultSlices;
    if (settings?.rouletteWinChances) {
      if (typeof settings.rouletteWinChances === 'string') {
        try { slices = JSON.parse(settings.rouletteWinChances); } catch(e){}
      } else if (Array.isArray(settings.rouletteWinChances)) {
        slices = settings.rouletteWinChances as any;
      }
    }

    const rand = Math.random() * 100;
    let selectedDiscount = slices[0]?.discount || 10;
    
    let cumulative = 0;
    for (const slice of slices) {
      cumulative += slice.chance;
      if (rand <= cumulative) {
        selectedDiscount = slice.discount;
        break;
      }
    }

    // Apply discount for 60 minutes
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        activeDiscountPercent: selectedDiscount,
        discountExpiresAt: expiresAt
      }
    });

    await prisma.coinsHistory.create({
      data: {
        userId,
        amount: 0,
        reason: 'roulette_spin'
      }
    });

    return NextResponse.json({ 
      success: true, 
      discount: selectedDiscount, 
      expiresAt 
    });

  } catch (error) {
    console.error('Spin Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
