'use server';

import prisma from '@/lib/prisma';
import { SocialPlatform } from '@prisma/client';

export async function getSocialAccounts() {
  try {
    const accounts = await prisma.socialAccount.findMany({
      orderBy: { name: 'asc' }
    });
    return { success: true, data: accounts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createSocialAccount(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const platform = formData.get('platform') as SocialPlatform;
    
    if (!name || !platform) {
      return { success: false, error: 'Всі поля обов\'язкові' };
    }

    await prisma.socialAccount.create({
      data: {
        name,
        platform,
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteSocialAccount(id: string) {
  try {
    await prisma.socialAccount.delete({
      where: { id }
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
