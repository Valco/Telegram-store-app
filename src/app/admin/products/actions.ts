'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

import fs from 'fs/promises';
import path from 'path';

const CYRILLIC_TO_LATIN: Record<string, string> = {
  'А':'A', 'Б':'B', 'В':'V', 'Г':'H', 'Ґ':'G', 'Д':'D', 'Е':'E', 'Є':'YE', 'Ж':'ZH', 'З':'Z', 'И':'Y', 'І':'I', 'Ї':'YI', 'Й':'Y', 'К':'K', 'Л':'L', 'М':'M', 'Н':'N', 'О':'O', 'П':'P', 'Р':'R', 'С':'S', 'Т':'T', 'У':'U', 'Ф':'F', 'Х':'KH', 'Ц':'TS', 'Ч':'CH', 'Ш':'SH', 'Щ':'SHCH', 'Ю':'YU', 'Я':'YA',
  'а':'a', 'б':'b', 'в':'v', 'г':'h', 'ґ':'g', 'д':'d', 'е':'e', 'є':'ye', 'ж':'zh', 'з':'z', 'и':'y', 'і':'i', 'ї':'yi', 'й':'y', 'к':'k', 'л':'l', 'м':'m', 'н':'n', 'о':'o', 'п':'p', 'р':'r', 'с':'s', 'т':'t', 'у':'u', 'ф':'f', 'х':'kh', 'ц':'ts', 'ч':'ch', 'ш':'sh', 'щ':'shch', 'ю':'yu', 'я':'ya'
};

function transliterate(text: string) {
  return text.split('').map(char => CYRILLIC_TO_LATIN[char] || char).join('').toUpperCase();
}

async function generateSku(categoryId: string) {
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) return null;
  const prefix = transliterate(cat.name).replace(/[^A-Z]/g, '').substring(0, 2).padEnd(2, 'X');
  
  let isUnique = false;
  let sku = '';
  while (!isUnique) {
    const num = Math.floor(100000 + Math.random() * 900000).toString();
    sku = `${prefix}${num}`;
    const exists = await prisma.product.findUnique({ where: { sku } });
    if (!exists) isUnique = true;
  }
  return sku;
}

export async function createProduct(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const priceStr = formData.get('price') as string;
    const categoryId = formData.get('categoryId') as string;
    
    const isAutoPublish = formData.get('isAutoPublish') === 'on';
    const scheduledPublishAtStr = formData.get('scheduledPublishAt') as string;
    let scheduledPublishAt = null;
    if (scheduledPublishAtStr) {
       scheduledPublishAt = new Date(scheduledPublishAtStr);
    }
    
    if (!name || !priceStr || !categoryId) return { success: false, error: 'Заповніть всі обов\'язкові поля' };

    let images: string[] = [];
    const aiImageUrlsRaw = formData.get('aiImageUrls') as string | null;

    if (aiImageUrlsRaw) {
      try {
        images = JSON.parse(aiImageUrlsRaw);
      } catch(e) {}
    }
    
    const files = formData.getAll('images') as File[];
    for (const file of files) {
      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const savePath = path.join(process.cwd(), 'public/uploads', fileName);
        await fs.writeFile(savePath, buffer);
        images.push(`/uploads/${fileName}`);
      }
    }

    const stockStr = formData.get('stock') as string;
    let stock = parseInt(stockStr) || 0;
    
    let status = formData.get('status') as any || 'IN_STOCK';
    if (status !== 'OUT_OF_STOCK') {
       status = stock > 0 ? 'IN_STOCK' : 'MADE_TO_ORDER';
    }

    const sku = await generateSku(categoryId);

    const p = await prisma.product.create({
      data: {
        name,
        description: formData.get('description') as string || '',
        price: Math.round(parseFloat(priceStr) * 100), // store as copiykas
        categoryId,
        status,
        stock,
        images,
        sku,
        sourceUrl: formData.get('sourceUrl') as string | null,
        sizes: [],
        isPublished: isAutoPublish && !scheduledPublishAt, // publish immediately if no date
        scheduledPublishAt,
      }
    });

    if (isAutoPublish && !scheduledPublishAt) {
       await publishToTelegram(p.id);
    }



    revalidatePath('/admin/products');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка при збереженні товару' };
  }
}

export async function deleteProduct(id: string) {
  try {
    await prisma.product.delete({ where: { id } });
    revalidatePath('/admin/products');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Неможливо видалити (можливо є прив\'язані замовлення)' };
  }
}

export async function updateProduct(id: string, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const priceStr = formData.get('price') as string;
    const categoryId = formData.get('categoryId') as string;
    
    const stockStr = formData.get('stock') as string;
    let stock = parseInt(stockStr) || 0;
    
    let status = formData.get('status') as any || 'IN_STOCK';
    if (status !== 'OUT_OF_STOCK') {
       status = stock > 0 ? 'IN_STOCK' : 'MADE_TO_ORDER';
    }

    const isAutoPublish = formData.get('isAutoPublish') === 'on';
    const scheduledPublishAtStr = formData.get('scheduledPublishAt') as string;
    let scheduledPublishAt = null;
    if (scheduledPublishAtStr) {
       scheduledPublishAt = new Date(scheduledPublishAtStr);
    }
    
    if (!name || !priceStr || !categoryId) return { success: false, error: 'Заповніть всі обов\'язкові поля' };

    // Fetch existing
    const existing = await prisma.product.findUnique({ where: { id } });

    // We start with whatever URLs the client explicitly decided to keep or provided via AI
    let images: string[] = [];
    
    const aiImageUrlsRaw = formData.get('aiImageUrls') as string | null;
    if (aiImageUrlsRaw) {
      try {
        images = JSON.parse(aiImageUrlsRaw);
      } catch(e){}
    }
    
    // Append any explicitly uploaded new image files
    const files = formData.getAll('images') as File[];
    const validFiles = files.filter(f => f.size > 0);
    
    if (validFiles.length > 0) {
       for (const file of validFiles) {
          const bytes = await file.arrayBuffer();
          const buffer = Buffer.from(bytes);
          const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
          const savePath = path.join(process.cwd(), 'public/uploads', fileName);
          await fs.writeFile(savePath, buffer);
          images.push(`/uploads/${fileName}`);
       }
    }

    await prisma.product.update({
      where: { id },
      data: {
        name,
        description: formData.get('description') as string || '',
        price: Math.round(parseFloat(priceStr) * 100),
        categoryId,
        status: status as any,
        stock,
        images,
        sourceUrl: formData.get('sourceUrl') as string | null,
        // Only override publish times if provided
        ...(scheduledPublishAt !== null ? { scheduledPublishAt } : {}),
      }
    });

    if (isAutoPublish && !existing?.tgPostId && !scheduledPublishAtStr) {
       await publishToTelegram(id);
    }

    revalidatePath('/admin/products');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка при оновленні товару' };
  }
}

export async function publishToTelegram(productId: string) {
  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return { success: false, error: 'Товар не знайдено' };

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) return { success: false, error: 'Токен бота не налаштовано' };

    const settings = await prisma.settings.findFirst();
    let CHANNEL_ID = settings?.telegramGroupId?.trim();

    if (!CHANNEL_ID) {
      return { success: false, error: 'В Налаштуваннях не вказано ID Telegram-групи/каналу (вкладка Налаштування)' };
    }
    
    // Auto-fix if user pasted https://t.me/ChannelName
    if (CHANNEL_ID.includes('t.me/')) {
      CHANNEL_ID = CHANNEL_ID.split('t.me/').pop()?.split('/')[0] || CHANNEL_ID;
    }
    // Auto-fix if user forgot the @ symbol for a public channel (and it's not a private -100 numeric ID)
    if (!CHANNEL_ID.startsWith('@') && !CHANNEL_ID.startsWith('-')) {
      CHANNEL_ID = '@' + CHANNEL_ID;
    }
    
    // Fallback mini app url. Change "app" or "store" if your botfather shortname is different.
    const miniAppUrl = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://t.me/telstoredh3d_bot/dh3d_toy_store';
    const deepLink = `${miniAppUrl}?startapp=${product.id}`;

    // Telegram caption limit is 1024 characters
    let truncatedDesc = product.description;
    const maxDescLength = 850; // Leave room for title, formatting, and price
    if (truncatedDesc && truncatedDesc.length > maxDescLength) {
       // Find last space before cutoff to avoid breaking words
       const cutoff = truncatedDesc.lastIndexOf(' ', maxDescLength);
       truncatedDesc = truncatedDesc.substring(0, cutoff > 0 ? cutoff : maxDescLength).trim() + '...';
    }

    const caption = `🚀 <b>Новий товар в наявності!</b>
📦 ${product.name}

${truncatedDesc ? `📝 ${truncatedDesc}\n\n` : ''}💰 Вартість: ${(product.price / 100).toFixed(2)} грн.`;

    const reply_markup = {
      inline_keyboard: [[
        {
          text: "🛍 Відкрити та Купити",
          url: deepLink
        }
      ]]
    };

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://your-domain.com';
    let url = `https://api.telegram.org/bot${BOT_TOKEN}`;

    let messageIdToSave = '';

    if (product.images.length > 1) {
      // Multiple photos: use sendMediaGroup (max 3 images)
      const imagesToSend = product.images.slice(0, 3);
      
      const formData = new FormData();
      formData.append('chat_id', CHANNEL_ID);

      const mediaGroupDef = [];
      for (let i = 0; i < imagesToSend.length; i++) {
        try {
          const filePath = path.join(process.cwd(), 'public', imagesToSend[i]);
          const buffer = await fs.readFile(filePath);
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          formData.append(`file_${i}`, blob, `image_${i}.jpg`);
          
          mediaGroupDef.push({
            type: 'photo',
            media: `attach://file_${i}`
          });
        } catch (e) {
            console.error('Failed to attach image to media group', e);
        }
      }
      formData.append('media', JSON.stringify(mediaGroupDef));

      // 1. Send Media Group (ONLY Photos, no caption)
      const res1 = await fetch(`${url}/sendMediaGroup`, {
        method: 'POST',
        body: formData
      });
      const result1 = await res1.json();
      
      if (!result1.ok) {
        let errorMsg = result1.description || 'Помилка відправки Telegram API (Альбом)';
        if (errorMsg.includes('chat not found')) errorMsg = `Канал "${CHANNEL_ID}" не знайдено! Переконайтеся, що бот доданий як адміністратор.`;
        return { success: false, error: errorMsg };
      }

      // Save the message ID of the first photo in the album
      messageIdToSave = result1.result[0].message_id.toString();

      // 2. Send the Full Text and Inline Keyboard in a separate message right beneath the photos
      await fetch(`${url}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          text: caption,
          parse_mode: 'HTML',
          reply_markup
        })
      });

    } else {
      // Single photo or text only: use sendPhoto or sendMessage
      if (product.images.length === 1) {
        const formData = new FormData();
        formData.append('chat_id', CHANNEL_ID);
        formData.append('caption', caption);
        formData.append('parse_mode', 'HTML');
        formData.append('reply_markup', JSON.stringify(reply_markup));
        
        try {
          const filePath = path.join(process.cwd(), 'public', product.images[0]);
          const buffer = await fs.readFile(filePath);
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          formData.append('photo', blob, 'image.jpg');
        } catch (e) {
          console.error('Failed to attach image to sendPhoto', e);
        }

        const res = await fetch(`${url}/sendPhoto`, {
          method: 'POST',
          body: formData
        });
        
        const result = await res.json();
        if (!result.ok) {
          let errorMsg = result.description || 'Помилка відправки Telegram API (sendPhoto)';
          if (errorMsg.includes('chat not found')) errorMsg = `Канал "${CHANNEL_ID}" не знайдено! Переконайтеся, що бот доданий як адміністратор.`;
          return { success: false, error: errorMsg };
        }
        messageIdToSave = result.result.message_id.toString();

      } else {
        // Text only
        let body: any = {
          chat_id: CHANNEL_ID,
          text: caption,
          parse_mode: 'HTML',
          reply_markup: reply_markup
        };
        const res = await fetch(`${url}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const result = await res.json();
        if (!result.ok) {
           return { success: false, error: result.description || 'Помилка sendMessage' };
        }
        messageIdToSave = result.result.message_id.toString();
      }
    }

    await prisma.product.update({
      where: { id: product.id },
      data: {
        isPublished: true,
        tgPostId: messageIdToSave
      }
    });

    revalidatePath('/admin/products');
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Критична помилка при публікації в Telegram' };
  }
}

export async function bulkUpdateProducts(productIds: string[], updateData: any) {
  try {
    if (!productIds || productIds.length === 0) return { success: false, error: 'No products selected' };

    let data: any = {};
    if (updateData.price) data.price = Math.round(parseFloat(updateData.price) * 100);
    
    if (updateData.stock !== undefined && updateData.stock !== null && updateData.stock !== '') {
       data.stock = parseInt(updateData.stock) || 0;
    }
    
    if (updateData.status) {
       data.status = updateData.status;
    } else if (data.stock !== undefined) {
       data.status = data.stock > 0 ? 'IN_STOCK' : 'MADE_TO_ORDER';
    }

    if (Object.keys(data).length === 0) return { success: true };

    await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data
    });

    revalidatePath('/admin/products');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Bulk update failed' };
  }
}

export async function generateSMMForProduct(productId: string) {
  try {
    const { triggerSMMGeneration } = await import('@/lib/smmService');
    const res: any = await triggerSMMGeneration(productId);
    revalidatePath('/admin/smm');
    if (res && res.success) {
       const total = (res.stats?.facebook || 0) + (res.stats?.instagramPhotos || 0) + (res.stats?.instagramReels || 0);
       if (total === 0) {
          return { success: false, error: 'Генерація не створила жодного посту (перевірте промпти та налаштування).' };
       }
       return { success: true, stats: res.stats };
    }
    return { success: false, error: res?.error || 'Помилка генерації' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Помилка при ручній генерації SMM' };
  }
}
