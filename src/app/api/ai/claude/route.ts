import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { canUseFeature } from '@/lib/license';

export async function POST(req: NextRequest) {
  try {
    // Phase 2: License check
    if (!(await canUseFeature('AI'))) {
      return NextResponse.json({ success: false, error: 'PRO_REQUIRED', feature: 'AI', upgradeUrl: '/admin/support' }, { status: 403 });
    }

    const body = await req.json();
    const { name, themeId, imageUrl, clientBase64Image } = body;

    console.log(`API AI ACTION 2: generateProductTextWithClaude STARTED for imageUrl: ${imageUrl}, themeId: ${themeId}`);
    if (themeId === 'none') {
      return NextResponse.json({ success: true, text: '' });
    }

    const settings = await prisma.settings.findFirst();
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Ключ Claude (Anthropic) не налаштовано (перевірте ANTHROPIC_API_KEY в .env)' }, { status: 400 });
    }

    // Fetch dynamic prompt from DB
    const promptRecord = await prisma.prompt.findUnique({ where: { id: themeId } });
    if (!promptRecord) {
       return NextResponse.json({ success: false, error: 'Вказаний промпт не знайдено в базі' }, { status: 400 });
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
      console.log(`API AI ACTION 2: Using pre-compressed client-side image of size ~${Math.round(clientBase64Image.length / 1024)}KB`);
      base64Image = clientBase64Image;
      mediaType = 'image/jpeg';
    } else {
      const absoluteImagePath = path.join(process.cwd(), 'public', imageUrl);
      console.log(`API AI ACTION 2: Reading image from ${absoluteImagePath}`);
      try {
        // Use Next.js built-in Image Optimizer to shrink it on the fly!
        const port = process.env.PORT || 4000;
        const optimizerUrl = `http://127.0.0.1:${port}/_next/image?url=${encodeURIComponent(imageUrl)}&w=1080&q=75`;
        console.log(`API AI ACTION 2: Trying to optimize via ${optimizerUrl}`);
        const optRes = await fetch(optimizerUrl);
        
        if (optRes.ok) {
           const buffer = await optRes.arrayBuffer();
           base64Image = Buffer.from(buffer).toString('base64');
           mediaType = optRes.headers.get('content-type') || 'image/webp';
           console.log(`API AI ACTION 2: Successfully optimized server image, new size: ~${Math.round(base64Image.length / 1024)}KB`);
        } else {
           console.warn(`API AI ACTION 2: Optimization failed ${optRes.status}, falling back to raw disk read.`);
           const imgBuffer = await fs.readFile(absoluteImagePath);
           base64Image = imgBuffer.toString('base64');
           if (imageUrl.toLowerCase().endsWith('.png')) mediaType = 'image/png';
           if (imageUrl.toLowerCase().endsWith('.webp')) mediaType = 'image/webp';
        }
      } catch (fsErr) {
        console.error('API AI ACTION 2: Failed to read/optimize image for Claude:', fsErr);
        return NextResponse.json({ success: false, error: 'Неможливо завантажити оброблене фото для аналізу AI' }, { status: 500 });
      }
    }

    console.log(`API AI ACTION 2: Sending request to Anthropic Claude API...`);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings?.anthropicModel || 'claude-sonnet-4-6',
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
      console.error(`API AI ACTION 2: Anthropic API Error (Status ${response.status}):`, errText);
      return NextResponse.json({ success: false, error: 'Помилка генерації тексту (Claude API)' }, { status: 502 });
    }

    console.log(`API AI ACTION 2: Claude API request successful`);
    const data = await response.json();
    const generatedText = data?.content?.[0]?.text?.trim() || '';

    return NextResponse.json({ success: true, text: generatedText });

  } catch (error: any) {
    console.error('Claude API Exception:', error);
    return NextResponse.json({ success: false, error: 'Помилка при зв\'язку з сервером Anthropic' }, { status: 500 });
  }
}
