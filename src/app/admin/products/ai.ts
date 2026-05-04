'use server';

import prisma from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { requireFeature } from '@/lib/license';

// The 'none' prompt is handled dynamically in generateProductTextWithClaude

/**
 * Extract OpenGraph Main Image from an external Product URL bypassing Cloudflare using Microlink
 */
export async function extractImageFromProductUrl(url: string) {
  try {
    const encodedUrl = encodeURIComponent(url);
    const apiRes = await fetch(`https://api.microlink.io/?url=${encodedUrl}`);
    if (!apiRes.ok) throw new Error(`Microlink err HTTP ${apiRes.status}`);
    
    const json = await apiRes.json();
    if (json.status !== 'success' || !json.data) {
      throw new Error('Microlink API не повернув дані');
    }
    
    const imageUrl = json.data.image?.url || json.data.logo?.url;
    if (!imageUrl) {
      throw new Error('Не знайдено фотографію на цій сторінці');
    }
    
    return { success: true, imageUrl };
  } catch (error: any) {
    console.error('Extract Image error:', error);
    return { success: false, error: error.message || 'Помилка вилучення зображення' };
  }
}

/**
 * Fetch Image from external URL and convert to Base64 (to act exactly like an uploaded file)
 */
export async function fetchBase64FromUrl(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    
    let contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // basic filename extraction from URL
    let name = 'downloaded_image.jpg';
    try {
      const parsedUrl = new URL(url);
      const urlPaths = parsedUrl.pathname.split('/');
      const lastPath = urlPaths[urlPaths.length - 1];
      if (lastPath && lastPath.includes('.')) name = lastPath;
    } catch(e) {}

    return { success: true, file: { name, type: contentType, base64 } };
  } catch(error: any) {
    console.error('Fetch URL error:', error);
    return { success: false, error: 'Помилка завантаження фото за посиланням (можливо блокування Cloudflare або неправильний URL).' };
  }
}

/**
 * 1. Process Multiple Photos via Photoroom API
 */
export async function processMultiplePhotosWithPhotoroom(
  photos: { name: string; type: string; base64: string }[]
) {
  try {
    await requireFeature('AI');
    console.log('AI ACTION 1: processMultiplePhotosWithPhotoroom STARTED. Files count:', photos?.length);
    if (!photos || photos.length === 0) {
      console.log('AI ACTION 1: No files provided.');
      return { success: false, error: 'Файли не знайдено' };
    }

    const settings = await prisma.settings.findFirst();
    const env = process.env.PHOTOROOM_ENVIRONMENT || 'sandbox';
    const apiKey = env === 'live'
      ? process.env.PHOTOROOM_LIVE_KEY
      : process.env.PHOTOROOM_SANDBOX_KEY;

    if (!apiKey) {
      return { success: false, error: 'API Ключ Photoroom не налаштовано (перевірте PHOTOROOM_LIVE_KEY або PHOTOROOM_SANDBOX_KEY в .env)' };
    }

    const processedUrls: string[] = [];

    // Process concurrently
    const promises = photos.map(async (photo) => {
        const fileBuffer = Buffer.from(photo.base64, 'base64');
        const fileBlob = new Blob([fileBuffer], { type: photo.type });
        
        const prFormData = new FormData();
        prFormData.append('imageFile', fileBlob, photo.name || 'image.jpg');
        
        prFormData.append('background.color', '#FFFFFF');
        prFormData.append('padding', '0.1'); 
        prFormData.append('shadow.mode', 'ai.soft');

        const res = await fetch('https://image-api.photoroom.com/v2/edit', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
          },
          body: prFormData,
        });
        
        console.log(`AI ACTION 1: Photoroom API response status: ${res.status}`);

        if (!res.ok) {
          const errorText = await res.text();
          console.error('Photoroom Error:', errorText);
          throw new Error(`Photoroom API Error: ${res.statusText}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`AI ACTION 1: Photoroom API returned buffer of size: ${buffer.length}`);
        
        // Save locally (Photoroom ALWAYS returns PNG)
        const safeName = photo.name ? photo.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, '_') : 'image';
        const fileName = `ai-${Date.now()}-${safeName}.png`;
        const savePath = path.join(process.cwd(), 'public/uploads', fileName);
        console.log(`AI ACTION 1: Writing to ${savePath}`);
        await fs.writeFile(savePath, buffer);
        console.log(`AI ACTION 1: Successfully written to ${savePath}`);
        
        return `/uploads/${fileName}`;
    });

    const results = await Promise.all(promises);
    console.log('AI ACTION 1: All photos processed successfully:', results);
    return { success: true, urls: results };
  } catch (error: any) {
    console.error('Photoroom Exception:', error);
    return { success: false, error: error.message || 'Помилка при обробці фото сервісом Photoroom' };
  }
}

/**
 * 2. Generate Text via Anthropic Claude 3.5 Sonnet
 */
export async function generateProductTextWithClaude(name: string, themeId: string, imageUrl: string, clientBase64Image?: string) {
  try {
    await requireFeature('AI');
    console.log(`AI ACTION 2: generateProductTextWithClaude STARTED`);
    console.log(`AI ACTION 2: PARAMS: name=${name}, themeId=${themeId}, imageUrl=${imageUrl}, base64Len=${clientBase64Image?.length || 0}`);
    if (themeId === 'none') {
      return { success: true, text: '' };
    }

    const settings = await prisma.settings.findFirst();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'API Ключ Claude (Anthropic) не налаштовано (перевірте ANTHROPIC_API_KEY в .env)' };
    }

    // Fetch dynamic prompt from DB
    const promptRecord = await prisma.prompt.findUnique({ where: { id: themeId } });
    if (!promptRecord) {
       return { success: false, error: 'Вказаний промпт не знайдено в базі' };
    }

    const systemPromptText = promptRecord.content;
    const systemPrompt = `${systemPromptText}

ОБОВ'ЯЗКОВІ ГЛОБАЛЬНІ ПРАВИЛА (СУВОРО ТА БЕЗУМОВНО ДОТРИМУЙСЯ):
1. НІКОЛИ не згадуй про ціну, вартість, гроші або фрази типу "Ціна в дірект".
2. НІКОЛИ не пиши про наявність або відсутність товару (наприклад "є в наявності", "останній шанс", "доступно до замовлення").
3. Наприкінці тексту ЗАВЖДИ додавай заклик до дії, який пропонує натиснути кнопку. Наприклад: "👇 Тисни на кнопку «Відкрити та Купити» нижче, щоб оформити замовлення!" або подібне, але ОБОВ'ЯЗКОВО зі згадкою про кнопку.`;

    let base64Image = '';
    let mediaType = 'image/jpeg';
    
    if (clientBase64Image) {
      console.log(`AI ACTION 2: Using pre-compressed client-side image of size ~${Math.round(clientBase64Image.length / 1024)}KB`);
      base64Image = clientBase64Image;
      mediaType = 'image/jpeg';
    } else {
      const absoluteImagePath = path.join(process.cwd(), 'public', imageUrl);
      console.log(`AI ACTION 2: Reading image from ${absoluteImagePath}`);
      try {
        const imgBuffer = await fs.readFile(absoluteImagePath);
        base64Image = imgBuffer.toString('base64');
        if (imageUrl.toLowerCase().endsWith('.png')) mediaType = 'image/png';
        if (imageUrl.toLowerCase().endsWith('.webp')) mediaType = 'image/webp';
      } catch (fsErr) {
        console.error('AI ACTION 2: Failed to read image for Claude:', fsErr);
        return { success: false, error: 'Неможливо завантажити оброблене фото для аналізу AI' };
      }
    }

    console.log(`AI ACTION 2: Sending request to Anthropic Claude API...`);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings?.anthropicModel || 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: `Це фото нашого товару. Назва: "${name}". Будь ласка, напиши рекламний пост-опис для Telegram-магазину. Напиши ОДРАЗУ готовий текст, без вітань і пояснень на кшталт "Ось твій текст:".`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI ACTION 2: Anthropic API Error (Status ${response.status}):`, errText);
      return { success: false, error: 'Помилка генерації тексту (Claude API)' };
    }

    console.log(`AI ACTION 2: Claude API request successful`);
    const data = await response.json();
    const generatedText = data?.content?.[0]?.text?.trim() || '';

    return { success: true, text: generatedText };

  } catch (error: any) {
    console.error('Claude Exception:', error);
    return { success: false, error: 'Помилка при зв\'язку з сервером Anthropic' };
  }
}
