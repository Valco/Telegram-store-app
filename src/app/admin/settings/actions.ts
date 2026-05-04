'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function getSettings() {
  try {
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      // Create defaults if not exists
      settings = await prisma.settings.create({
        data: {
          maxCoinsPercent: 40,
          storageProvider: 'local',
        }
      });
    }
    return { success: true, data: settings };
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return { success: false, error: 'Помилка завантаження налаштувань' };
  }
}

export async function updateSettings(formData: FormData) {
  try {
    const id = formData.get('id') as string;
    const maxCoinsPercent = parseInt(formData.get('maxCoinsPercent') as string, 10);
    const coinToUahRate = parseInt(formData.get('coinToUahRate') as string, 10);
    const welcomeBonusCoins = parseInt(formData.get('welcomeBonusCoins') as string, 10);
    const cashbackPercent = parseInt(formData.get('cashbackPercent') as string, 10);
    const googleAnalyticsId = formData.get('googleAnalyticsId') as string;
    const metaPixelId = formData.get('metaPixelId') as string;
    const storageProvider = formData.get('storageProvider') as string;

    // Notifications
    const siteName = (formData.get('siteName') as string) || 'Telegram Store';
    const adminEmail = formData.get('adminEmail') as string;
    const telegramGroupId = formData.get('telegramGroupId') as string;

    // AI model settings (keys are in .env — not stored in DB)
    const anthropicModel = (formData.get('anthropicModel') as string) || 'claude-sonnet-4-6';
    const imageGenerator = formData.get('imageGenerator') as string;

    // Pickup
    const enablePickup = formData.get('enablePickup') === 'true';
    const pickupAddress = (formData.get('pickupAddress') as string) || '';
    
    const photoroomPromptsRaw = formData.get('photoroomPrompts') as string;
    let photoroomPrompts = undefined;
    if (photoroomPromptsRaw) {
       photoroomPrompts = JSON.parse(photoroomPromptsRaw);
    }

    // SMM
    const autoApproveFbPost = formData.get('autoApproveFbPost') === 'true';
    const autoApproveInstaPost = formData.get('autoApproveInstaPost') === 'true';
    const autoApproveInstaReels = formData.get('autoApproveInstaReels') === 'true';

    // Roulette
    const rouletteWinChancesRaw = formData.get('rouletteWinChances') as string;
    let rouletteWinChances = undefined;
    if (rouletteWinChancesRaw) {
       rouletteWinChances = JSON.parse(rouletteWinChancesRaw);
    }

    await prisma.settings.update({
      where: { id },
      data: {
        maxCoinsPercent: isNaN(maxCoinsPercent) ? 15 : maxCoinsPercent,
        coinToUahRate: isNaN(coinToUahRate) ? 10 : coinToUahRate,
        welcomeBonusCoins: isNaN(welcomeBonusCoins) ? 1000 : welcomeBonusCoins,
        cashbackPercent: isNaN(cashbackPercent) ? 0 : cashbackPercent,
        googleAnalyticsId,
        metaPixelId,
        storageProvider,
        siteName,
        adminEmail,
        telegramGroupId,
        rouletteWinChances,
        anthropicModel,
        photoroomPrompts,
        imageGenerator,
        autoApproveFbPost,
        autoApproveInstaPost,
        autoApproveInstaReels,
        enablePickup,
        pickupAddress,
      },
    });

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return { success: false, error: error.message || String(error) };
  }
}
