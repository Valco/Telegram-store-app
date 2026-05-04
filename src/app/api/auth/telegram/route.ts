import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { encryptJWT } from '@/lib/auth'; // Reusing JWT logic from Admin

export async function POST(request: Request) {
  try {
    const { initData } = await request.json();
    if (!initData) return NextResponse.json({ error: 'No initData' }, { status: 400 });

    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    
    const settings = await prisma.settings.findFirst();
    const welcomeBonus = settings?.welcomeBonusCoins ?? 1000;

    // Handle Standard Web Browser Guests
    if (initData.startsWith('WEB_GUEST:')) {
       const guestId = initData.split(':')[1];
       const user = await prisma.user.upsert({
         where: { id: guestId },
         update: { lastLoginAt: new Date() },
         create: {
           id: guestId,
           username: guestId,
           firstName: 'Гість',
           lastName: 'Браузера',
           coinsBalance: 0 // Do not give welcome bonuses to incognito abusers
         }
       });

       const token = await encryptJWT({ userId: user.id, role: 'CUSTOMER', dbRole: 'CUSTOMER', permissions: [] });
       return NextResponse.json({ success: true, token, user: { ...user, telegramId: null } });
    }

    // In local dev, if BOT_TOKEN is missing or if special 'MOCK_DEV_INIT_DATA' is sent, allow bypass
    if (initData === 'MOCK_DEV_INIT_DATA') {
       const user = await prisma.user.upsert({
         where: { telegramId: BigInt(123456789) },
         update: { lastLoginAt: new Date() },
         create: {
           telegramId: BigInt(123456789),
           username: 'dev_user',
           firstName: 'Dev',
           lastName: 'Local',
           coinsBalance: welcomeBonus
         }
       });

       const token = await encryptJWT({ userId: user.id, role: 'CUSTOMER', dbRole: 'CUSTOMER', permissions: [] });
       return NextResponse.json({ success: true, token, user: { ...user, telegramId: user.telegramId?.toString() } });
    }

    if (!botToken) {
      console.warn('Telegram auth failed: BOT_TOKEN is missing in env!');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Parse initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    // Check hash
    urlParams.sort();
    const dataCheckString = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
      
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return NextResponse.json({ error: 'Invalid hash' }, { status: 403 });
    }

    // Valid User
    const userStr = urlParams.get('user');
    if (!userStr) return NextResponse.json({ error: 'No user data' }, { status: 400 });
    
    const tgUser = JSON.parse(userStr);

    // Upsert into our DB
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        username: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        lastLoginAt: new Date()
      },
      create: {
        telegramId: BigInt(tgUser.id),
        username: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        coinsBalance: welcomeBonus
      }
    });

    // Welcome Bonus Check and History
    const coinHistoryCount = await prisma.coinsHistory.count({ where: { userId: user.id, reason: 'welcome_bonus' } });
    if (coinHistoryCount === 0 && welcomeBonus > 0) {
      if (user.coinsBalance === 0) {
        user.coinsBalance = welcomeBonus;
        await prisma.user.update({ where: { id: user.id }, data: { coinsBalance: welcomeBonus } });
      }
      await prisma.coinsHistory.create({ data: { userId: user.id, amount: welcomeBonus, reason: 'welcome_bonus' } });
    }

    const lastSpin = await prisma.coinsHistory.findFirst({
      where: { userId: user.id, reason: 'roulette_spin' },
      orderBy: { createdAt: 'desc' }
    });
    const hasRecentSpin = lastSpin ? (new Date().getTime() - lastSpin.createdAt.getTime() < 24 * 60 * 60 * 1000) : false;

    const token = await encryptJWT({ userId: user.id, username: tgUser.username, role: 'CUSTOMER', dbRole: 'CUSTOMER', permissions: [] });
    return NextResponse.json({ success: true, token, user: { ...user, telegramId: user.telegramId?.toString(), hasRecentSpin } });

  } catch (err) {
    console.error('Auth Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
