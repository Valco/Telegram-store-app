import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decryptJWT } from '@/lib/auth';
import { encryptJWT } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const sessionCookie = request.cookies.get('adminSession')?.value;
    const session = await decryptJWT(sessionCookie);

    if (!session || !session.userId) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    if (session.dbRole !== 'STAFF') {
      return NextResponse.redirect(new URL('/?error=forbidden', request.url));
    }

    const permissions = session.permissions || [];
    let hasAccess = true;

    if (path.startsWith('/admin/settings') && !permissions.includes('MANAGE_SETTINGS')) {
      hasAccess = false;
    }
    if (path.startsWith('/admin/users') && !permissions.includes('MANAGE_RBAC')) {
      hasAccess = false;
    }
    if (path.startsWith('/admin/products') || path.startsWith('/admin/categories')) {
      if (!permissions.includes('MANAGE_PRODUCTS') && !permissions.includes('MANAGE_CATEGORIES')) {
        hasAccess = false;
      }
    }

    if (!hasAccess) {
      return NextResponse.redirect(new URL('/?error=forbidden', request.url));
    }

    // Sliding Window: Re-issue JWT to extend session by 5 hours
    const response = NextResponse.next();
    const newSession = await encryptJWT({
      userId: session.userId,
      email: session.email,
      role: session.role,
      dbRole: session.dbRole,
      permissions: session.permissions,
    });

    response.cookies.set('adminSession', newSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60 * 60,
    });

    return response;
  }

  // If already logged in and visiting login page → redirect to admin
  if (path.startsWith('/admin/login')) {
    const sessionCookie = request.cookies.get('adminSession')?.value;
    const session = await decryptJWT(sessionCookie);
    if (session?.userId && session?.dbRole === 'STAFF') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
