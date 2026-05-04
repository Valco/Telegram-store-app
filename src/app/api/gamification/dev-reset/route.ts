import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.user.updateMany({
      data: {
        activeDiscountPercent: null,
        discountExpiresAt: null,
      }
    });
    await prisma.coinsHistory.deleteMany({
      where: {
        reason: 'roulette_spin'
      }
    });
    return NextResponse.json({ success: true, message: 'Всі рулетки успішно скинуто! База даних очищена від старих виграшів.' });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Помилка скидання' }, { status: 500 });
  }
}
