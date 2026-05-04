import prisma from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { SocialPlatform, MediaType, PostStatus } from '@prisma/client';

import fs from 'fs/promises';
import path from 'path';

// Function for image generation (Photoroom)
async function generateAIPicture(originalUrl: string, settings: any): Promise<{ url: string, promptUsed: string | null }> {
  const env = process.env.PHOTOROOM_ENVIRONMENT || 'sandbox';
  const apiKey = env === 'live'
    ? process.env.PHOTOROOM_LIVE_KEY
    : process.env.PHOTOROOM_SANDBOX_KEY;

  if (settings.imageGenerator === 'photoroom' && apiKey) {
    try {
      // 1. Fetch or Read original image
      let imgBuffer: Buffer;
      if (originalUrl.startsWith('/')) {
         // Local file in public folder
         const localPath = path.join(process.cwd(), 'public', originalUrl);
         imgBuffer = await fs.readFile(localPath);
      } else {
         // External URL
         const imgRes = await fetch(originalUrl);
         if (!imgRes.ok) throw new Error('Cannot fetch original image');
         const arrayBuffer = await imgRes.arrayBuffer();
         imgBuffer = Buffer.from(arrayBuffer);
      }
      
      const blob = new Blob([new Uint8Array(imgBuffer)], { type: 'image/jpeg' });
      
      // 2. Select prompt
      let prPrompts: string[] = [];
      if (settings.photoroomPrompts && Array.isArray(settings.photoroomPrompts) && settings.photoroomPrompts.length > 0) {
        prPrompts = settings.photoroomPrompts as string[];
      } else {
        prPrompts = [
          "A bright, colorful children's playroom with soft natural light coming from a window. Wooden blocks and blurred toys in the background.",
          "A clean, modern minimalist studio with a solid pastel blue background and soft studio lighting.",
          "A cozy wooden desk with a small desk lamp casting a warm glow, with colorful fairy lights softly blurred in the background."
        ];
      }
      
      const validPrompts = prPrompts.filter(p => p.trim() !== '');
      let selectedPrompt = 'A beautiful studio background with soft lighting';
      let promptNumberText = 'Стандартний';

      if (validPrompts.length > 0) {
        const randomIndex = Math.floor(Math.random() * validPrompts.length);
        selectedPrompt = validPrompts[randomIndex];
        // Знаходимо оригінальний номер у налаштуваннях
        const originalIndex = prPrompts.indexOf(selectedPrompt);
        if (originalIndex !== -1) {
          promptNumberText = `Промпт №${originalIndex + 1}`;
        } else {
          promptNumberText = `Промпт №${randomIndex + 1}`;
        }
      }

      // 3. Prepare Photoroom API request
      const prFormData = new FormData();
      prFormData.append('imageFile', blob, 'image.jpg');
      prFormData.append('background.prompt', selectedPrompt);
      prFormData.append('padding', '0.1'); 
      prFormData.append('shadow.mode', 'ai.soft');

      console.log(`Sending to Photoroom with prompt: "${selectedPrompt}"`);

      // 4. Send request
      const res = await fetch('https://image-api.photoroom.com/v2/edit', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
        body: prFormData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Photoroom Error:', errorText);
        return { url: originalUrl, promptUsed: null }; // Fallback
      }

      // 5. Save generated image
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = `ai-smm-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const savePath = path.join(process.cwd(), 'public/uploads', fileName);
      await fs.writeFile(savePath, buffer);
      
      return { url: `/uploads/${fileName}`, promptUsed: promptNumberText };

    } catch (e) {
      console.error('Failed to generate AI picture via Photoroom:', e);
      return { url: originalUrl, promptUsed: null };
    }
  }
  
  return { url: originalUrl, promptUsed: null }; // Fallback to original
}


export async function triggerSMMGeneration(productId: string) {
  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    const settings = await prisma.settings.findFirst();
    
    if (!product || !settings) return;



    // Get active social accounts
    const socialAccounts = await prisma.socialAccount.findMany({
      where: { isActive: true }
    });

    const fbAccounts = socialAccounts.filter(a => a.platform === 'FACEBOOK');
    const instaAccounts = socialAccounts.filter(a => a.platform === 'INSTAGRAM');

    const firstImage = product.images?.[0] || 'https://via.placeholder.com/800';

    // 1. Generate Texts using Anthropic
    let fbText = `🔥 Новинка: ${product.name}\n\n${product.description}\n\nЦіна: ${product.price} грн`;
    let instaText = `✨ ${product.name} ✨\nШукаєте ідеальний варіант? Ось він! 😍\n\nЦіна: ${product.price} грн.\n\n#новинка #yourstore`;

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicApiKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicApiKey });
        const response = await anthropic.messages.create({
          model: settings.anthropicModel || 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: 'Ти - професійний SMM-менеджер. Твоє завдання створювати рекламні тексти для соцмереж.',
          messages: [
            {
              role: 'user',
              content: `Напиши 2 варіанти поста для товару "${product.name}" (Опис: ${product.description}). 
              Варіант 1 (для Facebook): Більш інформативний, з акцентом на користь та деталі.
              Варіант 2 (для Instagram): Короткий, емоційний, з емодзі та популярними хештегами.
              Поверни результат у форматі JSON: {"facebook": "текст", "instagram": "текст"}`
            }
          ]
        });
        const aiContent = response.content[0];
        if (aiContent.type === 'text') {
           let cleanText = aiContent.text.trim();
           if (cleanText.startsWith('```json')) {
              cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
           } else if (cleanText.startsWith('```')) {
              cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
           }
           const parsed = JSON.parse(cleanText);
           if (parsed.facebook) fbText = parsed.facebook;
           if (parsed.instagram) instaText = parsed.instagram;
        }
      } catch (e) {
        console.error('Anthropic SMM Error:', e);
      }
    }

    // Generate Image (Photoroom mock)
    const picRes = await generateAIPicture(firstImage, settings);
    const generatedImage = picRes.url;
    const usedPrompt = picRes.promptUsed;

    let fbPostsCreated = 0;
    let instaPhotoPostsCreated = 0;
    let instaReelsCreated = 0;

    // 3. Create Facebook Post
    const fbTargets = fbAccounts.length > 0 ? fbAccounts : [{ id: null }];
    for (const fbAcc of fbTargets) {
      await prisma.socialPost.create({
        data: {
          productId: product.id,
          platform: 'FACEBOOK',
          accountId: fbAcc.id,
          status: settings.autoApproveFbPost ? PostStatus.APPROVED : PostStatus.DRAFT,
          textContent: fbText,
          mediaUrls: [generatedImage],
          mediaType: MediaType.IMAGE,
          photoroomPrompt: usedPrompt
        }
      });
      fbPostsCreated++;
    }

    // 4. Create Instagram Photo Post
    const instaTargets = instaAccounts.length > 0 ? instaAccounts : [{ id: null }];
    for (const instaAcc of instaTargets) {
      await prisma.socialPost.create({
        data: {
          productId: product.id,
          platform: 'INSTAGRAM',
          accountId: instaAcc.id,
          status: settings.autoApproveInstaPost ? PostStatus.APPROVED : PostStatus.DRAFT,
          textContent: instaText,
          mediaUrls: [generatedImage],
          mediaType: MediaType.IMAGE,
          photoroomPrompt: usedPrompt
        }
      });
      instaPhotoPostsCreated++;
    }

    // 5. Create Instagram Reels (3 variants via Kling AI)
    /* ТИМЧАСОВО ВИМКНЕНО ЗА ЗАПИТОМ КОРИСТУВАЧА
    let klingPromptsArr: string[] = [];
    if (settings.klingPrompts && Array.isArray(settings.klingPrompts) && settings.klingPrompts.length > 0) {
      klingPromptsArr = settings.klingPrompts as string[];
    } else {
      klingPromptsArr = [
        `Cinematic 360 view of ${product.name}`,
        `Dynamic fast paced edit showing details of ${product.name}`,
        `Smooth aesthetic lifestyle shot featuring ${product.name}`
      ];
    }

    // Just take up to 3 prompts
    const promptsToUse = klingPromptsArr.slice(0, 3);
    
    for (const instaAcc of instaTargets) {
      for (const prompt of promptsToUse) {
         if (!prompt || prompt.trim() === '') continue; // Skip empty prompts
         
         const finalPrompt = prompt.replace('{{product_name}}', product.name).replace('{{product_desc}}', product.description || '');
         const videoUrl = await generateAIVideo(finalPrompt, firstImage, settings);

         await prisma.socialPost.create({
           data: {
             productId: product.id,
             platform: 'INSTAGRAM',
             accountId: instaAcc.id,
             status: settings.autoApproveInstaReels ? PostStatus.APPROVED : PostStatus.DRAFT,
             textContent: instaText, // usually same short text for reels
             mediaUrls: [videoUrl],
             mediaType: MediaType.REELS,
             klingPrompt: finalPrompt
           }
         });
         instaReelsCreated++;
      }
    }
    */

    return {
      success: true,
      stats: {
        facebook: fbPostsCreated,
        instagramPhotos: instaPhotoPostsCreated,
        instagramReels: instaReelsCreated
      }
    };
  } catch (err) {
    console.error('SMM Generation Error:', err);
    return { success: false, error: 'Внутрішня помилка генерації' };
  }
}

export async function regenerateSinglePostText(postId: string) {
  try {
    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: { product: true }
    });
    const settings = await prisma.settings.findFirst();

    if (!post || !post.product || !settings?.anthropicModel) {
      const envKey = process.env.ANTHROPIC_API_KEY;
      if (!post || !post.product || !envKey) {
        return { success: false, error: 'Недостатньо даних або немає API-ключа Anthropic' };
      }
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const isInsta = post.platform === 'INSTAGRAM';
    
    let sysPrompt = `Ти SMM експерт. Напиши 1 пост для ${post.platform}.
Вхідні дані:
Товар: ${post.product.name}
Опис: ${post.product.description || ''}
Ціна: ${post.product.price} грн

Поверни ЛИШЕ готовий текст поста (без коментарів, без JSON).`;

    if (isInsta) {
       sysPrompt += `\nФормат для Instagram: Емоційний гачок, короткий опис вигоди, заклик до дії, багато емодзі, 10-15 хештегів.`;
    } else {
       sysPrompt += `\nФормат для Facebook: Професійний, інформативний, детальний, менше емодзі, заклик переходити на сайт, 2-3 хештега.`;
    }

    const msg = await anthropic.messages.create({
      model: settings.anthropicModel || 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: sysPrompt,
      messages: [{ role: 'user', content: `Напиши пост для товару "${post.product.name}".` }],
    });

    // @ts-ignore
    const generatedText = msg.content[0]?.text?.trim() || '';

    if (generatedText) {
      await prisma.socialPost.update({
        where: { id: postId },
        data: { textContent: generatedText }
      });
      return { success: true, textContent: generatedText };
    }
    return { success: false, error: 'Не вдалося згенерувати текст' };
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}

export async function regenerateSinglePostMedia(postId: string) {
  try {
    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: { product: true }
    });
    const settings = await prisma.settings.findFirst();

    if (!post || !post.product || !settings) {
      return { success: false, error: 'Недостатньо даних' };
    }

    const firstImage = post.product.images?.[0] || 'https://via.placeholder.com/800';

    if (post.mediaType === MediaType.REELS) {
       const videoUrl = await generateAIVideo(post.klingPrompt || `Відео для ${post.product.name}`, firstImage, settings);
       await prisma.socialPost.update({
         where: { id: postId },
         data: { mediaUrls: [videoUrl] }
       });
       return { success: true, mediaUrls: [videoUrl] };
    } else {
       const picRes = await generateAIPicture(firstImage, settings);
       await prisma.socialPost.update({
         where: { id: postId },
         data: { 
           mediaUrls: [picRes.url],
           photoroomPrompt: picRes.promptUsed 
         }
       });
       return { success: true, mediaUrls: [picRes.url], promptUsed: picRes.promptUsed };
    }
  } catch (err: any) {
    console.error(err);
    return { success: false, error: err.message };
  }
}
