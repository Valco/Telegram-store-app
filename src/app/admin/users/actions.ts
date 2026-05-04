'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createRole(formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const isViewOnly = formData.get('permission_VIEW_ONLY') === 'on';
    
    // Collect all permissions checked by iterating formdata
    const permissions = Array.from(formData.keys())
        .filter(k => k.startsWith('permission_') && formData.get(k) === 'on')
        .map(k => k.replace('permission_', ''));

    if (!name) return { success: false, error: 'Введіть назву ролі' };

    await prisma.accessGroup.create({
      data: {
        name,
        permissions: permissions.length > 0 ? permissions : ['VIEW_ONLY']
      }
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка (можливо, вже існує така група)' };
  }
}

export async function updateRole(roleId: string, formData: FormData) {
  try {
    const name = formData.get('name') as string;
    const permissions = Array.from(formData.keys())
        .filter(k => k.startsWith('permission_') && formData.get(k) === 'on')
        .map(k => k.replace('permission_', ''));

    if (!name) return { success: false, error: 'Введіть назву ролі' };

    await prisma.accessGroup.update({
      where: { id: roleId },
      data: {
        name,
        permissions: permissions.length > 0 ? permissions : ['VIEW_ONLY']
      }
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка оновлення ролі' };
  }
}

export async function deleteRole(id: string) {
  try {
    await prisma.accessGroup.delete({ where: { id } });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Група містить користувачів - видалення неможливе' };
  }
}

export async function createStaffAccount(formData: FormData) {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const accessGroupId = formData.get('accessGroupId') as string;
    const requiresOtp = formData.get('requiresOtp') === 'on';

    if (!email || !password || !accessGroupId) return { success: false, error: 'Заповніть всі поля' };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { success: false, error: 'Емейл вже існує' };

    await prisma.user.create({
      data: {
        email,
        passwordHash: password, // For mock testing bypassing bcrypt
        role: 'STAFF',
        accessGroupId,
        requiresOtp
      }
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка створення акаунту' };
  }
}

export async function updateStaffAccount(userId: string, formData: FormData) {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const accessGroupId = formData.get('accessGroupId') as string;
    const requiresOtp = formData.get('requiresOtp') === 'on';

    if (!email || !accessGroupId) return { success: false, error: 'Заповніть всі поля' };

    const existing = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
    if (existing) return { success: false, error: 'Емейл вже використовується' };

    const updateData: any = {
      email,
      accessGroupId,
      requiresOtp
    };

    if (password && password.trim() !== '') {
      updateData.passwordHash = password; // Warning: Add bcrypt if security requested
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка оновлення акаунту' };
  }
}

export async function deleteStaffAccount(id: string) {
  try {
    // Prevent deleting superadmin protective logic
    const user = await prisma.user.findUnique({ where: { id } });
    if (user?.email === 'admin@tel.bot') {
      return { success: false, error: 'Головного Суперадміна видалити неможливо' };
    }

    await prisma.user.delete({ where: { id } });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Помилка видалення акаунту' };
  }
}
