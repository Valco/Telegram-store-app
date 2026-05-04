import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { PostStatus } from '@prisma/client';

// This endpoint is meant to be called periodically (e.g. hourly) by a cron service (Vercel Cron, GitHub Actions, etc.)
// GET /api/cron/publish-social
export async function GET(req: Request) {
  try {
    // Basic security check could be implemented here (e.g., check Authorization header against a CRON_SECRET)

    // Find posts that are APPROVED and haven't been published yet
    const approvedPosts = await prisma.socialPost.findMany({
      where: {
        status: PostStatus.APPROVED,
        // Optionally, we could check if scheduledFor is <= now() if we implement exact scheduling
      },
      take: 5 // Limit batch size to avoid timeouts
    });

    if (approvedPosts.length === 0) {
      return NextResponse.json({ success: true, message: 'No posts to publish' });
    }

    const publishedIds = [];

    for (const post of approvedPosts) {
      // Here you would make real API calls to Facebook Graph API or Instagram API
      // Example:
      // if (post.platform === 'INSTAGRAM') await publishToInstagram(post.accountId, post.mediaUrls, post.textContent);
      
      // Simulate successful publication
      await prisma.socialPost.update({
        where: { id: post.id },
        data: {
          status: PostStatus.PUBLISHED,
          publishedAt: new Date()
        }
      });
      
      publishedIds.push(post.id);
    }

    return NextResponse.json({ 
      success: true, 
      publishedCount: publishedIds.length,
      publishedIds
    });

  } catch (error: any) {
    console.error('CRON Publish Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
