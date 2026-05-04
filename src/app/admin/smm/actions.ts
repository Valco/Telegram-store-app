'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { PostStatus } from '@prisma/client';

export async function getSocialPosts() {
  try {
    const posts = await prisma.socialPost.findMany({
      include: {
        product: { select: { name: true, sku: true } },
        account: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data: posts };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updatePostStatus(id: string, status: PostStatus) {
  try {
    await prisma.socialPost.update({
      where: { id },
      data: { status }
    });
    revalidatePath('/admin/smm');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updatePostText(id: string, textContent: string) {
  try {
    await prisma.socialPost.update({
      where: { id },
      data: { textContent }
    });
    revalidatePath('/admin/smm');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletePost(id: string) {
  try {
    await prisma.socialPost.delete({ where: { id } });
    revalidatePath('/admin/smm');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function massDeletePosts(ids: string[]) {
  try {
    await prisma.socialPost.deleteMany({ where: { id: { in: ids } } });
    revalidatePath('/admin/smm');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function massApprovePosts(ids: string[]) {
  try {
    await prisma.socialPost.updateMany({ 
      where: { id: { in: ids } },
      data: { status: PostStatus.APPROVED }
    });
    revalidatePath('/admin/smm');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

import { regenerateSinglePostText as regenText, regenerateSinglePostMedia as regenMedia } from '@/lib/smmService';

export async function regeneratePostText(id: string) {
  const res = await regenText(id);
  revalidatePath('/admin/smm');
  return res;
}

export async function regeneratePostMedia(id: string) {
  const res = await regenMedia(id);
  revalidatePath('/admin/smm');
  return res;
}
