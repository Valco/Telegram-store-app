import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];

    console.log('API AI ACTION 1: Photoroom API Route STARTED. Files count:', files?.length);
    if (!files || files.length === 0) {
      console.log('API AI ACTION 1: No files provided.');
      return NextResponse.json({ success: false, error: 'Файли не знайдено' }, { status: 400 });
    }

    const settings = await prisma.settings.findFirst();
    const env = process.env.PHOTOROOM_ENVIRONMENT || 'sandbox';
    const apiKey = env === 'live'
      ? process.env.PHOTOROOM_LIVE_KEY
      : process.env.PHOTOROOM_SANDBOX_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API Ключ Photoroom не налаштовано (перевірте PHOTOROOM_*_KEY в .env)' }, { status: 400 });
    }

    const processedUrls: string[] = [];

    // Process concurrently
    const promises = files.map(async (file) => {
        const prFormData = new FormData();
        prFormData.append('imageFile', file, file.name || 'image.jpg');
        
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
        
        console.log(`API AI ACTION 1: Photoroom API response status: ${res.status}`);

        if (!res.ok) {
          const errorText = await res.text();
          console.error('Photoroom Error:', errorText);
          throw new Error(`Photoroom API Error: ${res.statusText}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`API AI ACTION 1: Photoroom API returned buffer of size: ${buffer.length}`);
        
        // Save locally (Photoroom ALWAYS returns PNG)
        const safeName = file.name ? file.name.replace(/\.[^/.]+$/, "").replace(/\s+/g, '_') : 'image';
        const fileName = `ai-${Date.now()}-${safeName}.png`;
        const savePath = path.join(process.cwd(), 'public/uploads', fileName);
        console.log(`API AI ACTION 1: Writing to ${savePath}`);
        await fs.writeFile(savePath, buffer);
        console.log(`API AI ACTION 1: Successfully written to ${savePath}`);
        
        return `/uploads/${fileName}`;
    });

    const results = await Promise.all(promises);
    console.log('API AI ACTION 1: All photos processed successfully:', results);
    return NextResponse.json({ success: true, urls: results });
  } catch (error: any) {
    console.error('Photoroom Exception:', error);
    return NextResponse.json({ success: false, error: error.message || 'Помилка при обробці фото сервісом Photoroom' }, { status: 500 });
  }
}
