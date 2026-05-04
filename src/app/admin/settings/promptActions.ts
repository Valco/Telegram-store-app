'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

const INITIAL_PROMPTS = [
  { name: 'Кумедний', content: 'Ти стендап-комік та маркетолог. Опиши цей 3D-надрукований товар максимально смішно та дотепно. Використовуй емодзі. Мінімум води, максимум позитиву.' },
  { name: 'Веселий', content: 'Ти супер-позитивний копірайтер. Зроби опис цього 3D-товару яскравим, радісним та таким, що дарує посмішку і бажання мати його. Використовуй емодзі.' },
  { name: 'Привабливий', content: 'Ти майстер з продажу естетичних речей. Текст має спокушати купити, звертаючи увагу на унікальну текстуру 3D-друку та милий вигляд.' },
  { name: 'Ексклюзивний', content: 'Ти продавець преміум-сегменту. Опиши цей об\'єкт як лімітовану колекційну річ, зроблену з великою увагою до деталей за допомогою високотехнологічного 3D-друку.' },
  { name: 'Ідея для подарунка', content: 'Ти експерт з підбору подарунків. Поясни, чому ця річ — ідеальний оригінальний подарунок-сюрприз для друзів, колег або дитини.' },
  { name: 'Антистрес', content: 'Ти зосереджений на ментальному здоров\'ї. Зроби акцент на тактильних відчуттях: розкажи, як ця 3D-модель знімає стрес і допомагає сфокусуватися на робочому місці.' }
];

export async function getPrompts() {
  try {
    let prompts = await prisma.prompt.findMany({ orderBy: { createdAt: 'asc' } });
    
    // Seed initial prompts if empty
    if (prompts.length === 0) {
      await prisma.prompt.createMany({
        data: INITIAL_PROMPTS
      });
      prompts = await prisma.prompt.findMany({ orderBy: { createdAt: 'asc' } });
    }
    // Deduplicate prompts by name (handles cases where seed ran twice)
    const uniquePrompts = [];
    const seen = new Set();
    for (const p of prompts) {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        uniquePrompts.push(p);
      }
    }
    
    return { success: true, data: uniquePrompts };
  } catch (error: any) {
    console.error('Error fetching prompts:', error);
    return { success: false, error: 'Помилка завантаження промптів' };
  }
}

export async function createPrompt(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const content = formData.get('content') as string;

    if (!name || !content) return { success: false, error: 'Всі поля обов\'язкові' };

    await prisma.prompt.create({
      data: { name, content }
    });

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error: any) {
    console.error('Error creating prompt:', error);
    return { success: false, error: 'Помилка створення промпту' };
  }
}

export async function updatePrompt(id: string, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const content = formData.get('content') as string;

    if (!name || !content) return { success: false, error: 'Всі поля обов\'язкові' };

    await prisma.prompt.update({
      where: { id },
      data: { name, content }
    });

    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating prompt:', error);
    return { success: false, error: 'Помилка оновлення промпту' };
  }
}

export async function deletePrompt(id: string) {
  try {
    await prisma.prompt.delete({ where: { id } });
    revalidatePath('/admin/settings');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting prompt:', error);
    return { success: false, error: 'Помилка видалення промпту' };
  }
}
