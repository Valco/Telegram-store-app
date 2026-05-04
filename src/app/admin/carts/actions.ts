'use server';

import prisma from '@/lib/prisma';

export async function getAbandonedCarts() {
  try {
    const carts = await prisma.cart.findMany({
      where: {
        items: { some: {} }, // cart has items
      },
      include: {
        user: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    return { success: true, data: carts };
  } catch (error) {
    return { success: false, error: 'Помилка завантаження' };
  }
}

export async function sendCartReminder(userId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.telegramId) {
      return { success: false, error: 'Користувач не прив\'язаний до Telegram' };
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return { success: false, error: 'TELEGRAM_BOT_TOKEN не налаштовано на сервері' };
    }

    const text = `🛒 *Ваш кошик сумує!*\n\nВи забули свої товари в магазині. Поверніться у додаток, щоб завершити покупку та отримати своє замовлення!`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramId.toString(),
        text,
        parse_mode: 'Markdown'
      })
    });

    if (!res.ok) {
       const errorData = await res.json().catch(() => ({}));
       console.error('Telegram API Error (Carts):', errorData);
       let errorMsg = errorData.description || 'Telegram API повернуло помилку.';
       
       if (errorMsg.includes("bot can't initiate conversation")) {
           errorMsg = "Неможливо надіслати: Користувач ще не запускав бота напряму (не натискав /start). Telegram забороняє ботам писати першими.";
       } else if (errorMsg.includes("bot was blocked")) {
           errorMsg = "Неможливо надіслати: Користувач заблокував бота.";
       } else if (errorMsg.includes("chat not found")) {
           errorMsg = "Неможливо надіслати: Чат з цим користувачем не знайдено.";
       }
       
       return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Внутрішня помилка при відправці' };
  }
}
