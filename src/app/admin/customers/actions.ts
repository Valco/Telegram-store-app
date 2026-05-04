'use server';

import prisma from '@/lib/prisma';

export async function getCustomers() {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      include: {
        _count: {
          select: { orders: true, carts: true }
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: { include: { product: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data: customers };
  } catch (error) {
    return { success: false, error: 'Помилка завантаження' };
  }
}

export async function checkTelegramBotStatus(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.telegramId) {
      return { success: true, status: 'NO_TELEGRAM', message: 'Немає Telegram ID' };
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return { success: false, error: 'Токен не налаштовано' };

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramId.toString(),
        action: 'typing'
      })
    });

    if (!res.ok) {
       const errorData = await res.json().catch(() => ({}));
       const desc = errorData.description || '';
       let rStatus = 'ERROR';
       let rMsg = desc;

       if (desc.includes("bot can't initiate conversation")) {
           rStatus = 'NOT_STARTED'; rMsg = 'Не запускав';
       } else if (desc.includes("bot was blocked")) {
           rStatus = 'BLOCKED'; rMsg = 'Заблокував';
       } else if (desc.includes("chat not found")) {
           rStatus = 'NOT_FOUND'; rMsg = 'Не знайдено';
       }
       
       if (['NOT_STARTED', 'BLOCKED', 'NOT_FOUND'].includes(rStatus)) {
           await prisma.user.update({ where: { id: userId }, data: { botSubscriptionStatus: rStatus } });
           return { success: true, status: rStatus, message: rMsg };
       }
       return { success: false, error: desc };
    }

    await prisma.user.update({ where: { id: userId }, data: { botSubscriptionStatus: 'ACTIVE' } });
    return { success: true, status: 'ACTIVE', message: 'Підписаний ✅' };
  } catch (error) {
    return { success: false, error: 'Внутрішня помилка' };
  }
}
