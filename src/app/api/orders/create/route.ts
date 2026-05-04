import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptJWT } from '@/lib/auth';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await decryptJWT(authHeader.split(' ')[1]);
    if (!payload?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const userId = payload.userId as string;
    const body = await request.json();
    
    const { cart, details, discountType } = body;
    if (!cart || cart.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });

    // Fetch realtime prices
    const products = await prisma.product.findMany({
      where: { id: { in: cart.map((c: any) => c.productId) } }
    });

    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart) {
      const p = products.find(x => x.id === item.productId);
      if (p) {
        totalAmount += p.price * item.quantity;
        orderItems.push({
          productId: p.id,
          quantity: Number(item.quantity) || 1,
          price: p.price,
        });
      }
    }

    // Apply Active Discount OR Coins
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const settings: any = await prisma.settings.findFirst() || { maxCoinsPercent: 15, coinToUahRate: 10 };
    
    let finalAmount = totalAmount;
    let coinsUsed = 0;
    
    if (discountType === 'roulette' && user.activeDiscountPercent && user.discountExpiresAt && user.discountExpiresAt > new Date()) {
      finalAmount = Math.floor(finalAmount * (1 - user.activeDiscountPercent / 100));
    } else if (discountType === 'coins' && user.coinsBalance > 0) {
      const maxCoinsAllowed = Math.floor((totalAmount / 100) * (settings.maxCoinsPercent / 100)) * settings.coinToUahRate;
      
      const requestedCoins = parseInt(body.coinsToUse);
      const safeRequested = isNaN(requestedCoins) ? user.coinsBalance : Math.max(0, requestedCoins);
      
      coinsUsed = Math.min(safeRequested, Math.min(user.coinsBalance, maxCoinsAllowed));
      
      const coinDiscountCents = Math.floor(coinsUsed / settings.coinToUahRate) * 100;
      finalAmount = Math.max(0, totalAmount - coinDiscountCents);
    }

    // Create Order
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random()*1000)}`;
    
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: userId,
        status: 'PENDING',
        totalAmount,
        finalAmount,
        coinsUsed,
        paymentMethod: details.paymentMethod || 'monobank',
        deliveryMethod: details.deliveryMethod || 'nova_poshta',
        deliveryCity: details.city,
        deliveryCityRef: details.cityRef,
        deliveryBranch: details.branch,
        deliveryBranchRef: details.branchRef,
        customerComment: details.comment,
        doNotCall: details.doNotCall,
        items: {
          create: orderItems
        }
      }
    });

    // Deduct stock for ordered items
    for (const item of orderItems) {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        const newStock = Math.max(0, p.stock - item.quantity);
        let newStatus = p.status;
        if (newStock <= 0 && newStatus !== 'OUT_OF_STOCK') {
          newStatus = 'MADE_TO_ORDER';
        }
        await prisma.product.update({
          where: { id: p.id },
          data: { stock: newStock, status: newStatus }
        });
      }
    }

    // Clear active discount if roulette was used. Deduct coins if coins were used.
    await prisma.user.update({
      where: { id: userId },
      data: { 
        activeDiscountPercent: discountType === 'roulette' ? null : user.activeDiscountPercent,
        discountExpiresAt: discountType === 'roulette' ? null : user.discountExpiresAt,
        coinsBalance: { decrement: coinsUsed },
        phone: details.phone, // Save phone for future checkouts
        firstName: details.firstName || user.firstName,
        lastName: details.lastName || user.lastName
      }
    });

    // Clear user's cart from DB to remove it from Abandoned Carts list
    const userCart = await prisma.cart.findUnique({ where: { userId } });
    if (userCart) {
      await prisma.cartItem.deleteMany({ where: { cartId: userCart.id } });
    }

    // Notifications: Send to Telegram Group and Admin Email
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const adminEmail = settings.adminEmail || process.env.SMTP_ADMIN_EMAIL || '';
    const tgGroup = settings.telegramGroupId;

    let itemsStr = '';
    orderItems.forEach((x, i) => {
       const pDetails = products.find(p => p.id === x.productId);
       itemsStr += `${i+1}. ${pDetails?.name || 'Товар'} x${x.quantity} - ${(x.price / 100).toFixed(2)} ₴\n`;
    });

    const notifMessage = `Нове Замовлення: ${orderNumber}
Клієнт: ${details.firstName || user.firstName} ${details.lastName || user.lastName}
Телефон: ${details.phone}
Місто: ${details.city || 'Не вказано'}
Відділення: ${details.branch || 'Не вказано'}
Оплата: ${details.paymentMethod}
До сплати: ${(finalAmount / 100).toFixed(2)} ₴
(Списано монет: ${coinsUsed} 🪙)

Коментар: ${details.comment || '-'}

Товари:
${itemsStr}`;

    // 1. Send to Telegram (Admin)
    if (botToken && tgGroup) {
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgGroup, text: notifMessage })
      }).catch(e => console.error('TG Push Failed:', e));
    }

    // 1.5 Send to Telegram (Customer - Pickup Cherkasy)
    if (botToken && user.telegramId && details.deliveryMethod === 'pickup_cherkasy') {
      const customerNotifMessage = `Дякуємо за ваше замовлення №${orderNumber}! 🎉\n\nОскільки більшість нашого асортименту виготовляється індивідуально під замовлення, нам знадобиться трохи часу на його підготовку.\nЯк тільки ваше замовлення буде повністю готове до видачі, ми одразу надішлемо вам сповіщення!\n\n📍 Адреса для самовивозу:\nм. Черкаси, вул. Припортова, 34 (ТЦ "Дніпро Плаза")\nПерший поверх, біля ескалатора — кавʼярня "Coffee Point CHE".\n\nОчікуйте на повідомлення про готовність. Дякуємо, що обираєте нас! ❤️`;
      
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: user.telegramId.toString(), text: customerNotifMessage })
      }).catch(e => console.error('TG Customer Push Failed:', e));
    }

    // 2. Send Email
    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        let transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_PORT === '465',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        const info = await transporter.sendMail({
          from: `"${settings.siteName || 'Telegram Store'}" <${process.env.SMTP_USER}>`,
          to: adminEmail,
          subject: `Нове замовлення ${orderNumber} — ${settings.siteName || 'Telegram Store'}`,
          text: notifMessage,
        });
        console.log('Admin Email sent automatically:', info.messageId);
      } else {
        console.log('[Mock Email] Would have sent to', adminEmail, ':\n', notifMessage);
      }
    } catch (e: any) {
      console.error('Email send failed:', e?.message || e);
    }

    // 3. Monobank Invoice Generation
    let paymentUrl = '/success';
    let invoiceId = null;

    if (details.paymentMethod === 'monobank' && process.env.MONOBANK_API_KEY) {
      try {
        const monoRes = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Token': process.env.MONOBANK_API_KEY
          },
          body: JSON.stringify({
            amount: finalAmount, // in kopecks
            ccy: 980, // UAH
            merchantPaymInfo: {
              reference: orderNumber,
              destination: `Оплата замовлення ${orderNumber}`,
              basketOrder: orderItems.map(item => {
                const pd = products.find(p => p.id === item.productId);
                return {
                  name: pd?.name || 'Товар',
                  qty: item.quantity,
                  sum: item.price,
                  icon: pd?.images?.[0] || '',
                  unit: 'шт'
                }
              })
            },
            redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com'}/success?orderId=${order.id}`,
            webHookUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com'}/api/webhooks/monobank`,
            validity: 3600 * 24 // 24 hours
          })
        });

        const monoData = await monoRes.json();
        
        if (monoRes.ok && monoData.invoiceId) {
          invoiceId = monoData.invoiceId;
          paymentUrl = monoData.pageUrl;
          
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentId: invoiceId }
          });
        }
      } catch (err) {
        console.error('Monobank Invoice Error:', err);
      }
    }

    return NextResponse.json({ success: true, orderId: order.id, paymentUrl });

  } catch (error) {
    console.error('Order Error:', error);
    return NextResponse.json({ error: 'Server validation error' }, { status: 500 });
  }
}
