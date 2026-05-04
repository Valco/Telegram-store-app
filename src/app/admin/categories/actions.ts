'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createCategory(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const parentId = formData.get('parentId') as string;

    if (!name || !slug) return { success: false, error: 'Назва та Slug обов\'язкові' };

    await prisma.category.create({
      data: {
        name,
        slug,
        parentId: parentId || null
      }
    });

    revalidatePath('/admin/categories');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка (можливо такий slug вже існує)' };
  }
}

export async function deleteCategory(id: string) {
  try {
    await prisma.category.delete({ where: { id } });
    revalidatePath('/admin/categories');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Не можна видалити (є вкладені елементи)' };
  }
}

export async function updateCategory(id: string, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const slug = formData.get('slug') as string;
    const parentId = formData.get('parentId') as string;

    if (!name || !slug) return { success: false, error: 'Назва та Slug обов\'язкові' };

    await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        parentId: parentId || null
      }
    });

    revalidatePath('/admin/categories');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка оновлення (можливо такий slug вже існує)' };
  }
}
