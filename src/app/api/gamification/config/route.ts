import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
        try { 
          rouletteSlices = JSON.parse(settings.rouletteWinChances); 
        } catch(e) {
          console.error('Failed to parse rouletteWinChances');
        }
      } else if (Array.isArray(settings.rouletteWinChances)) {
        rouletteSlices = settings.rouletteWinChances as any;
      }
    }

    return NextResponse.json({ success: true, slices: rouletteSlices });
  } catch (error) {
    console.error('Config Error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
