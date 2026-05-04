import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: any) {
  try {
    const params = await context.params;
    const urlPath = params.path;
    
    if (!urlPath || !Array.isArray(urlPath)) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const filename = urlPath.join('/');
    const filePath = path.join(process.cwd(), 'public/uploads', filename);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    let contentType = 'image/jpeg';
    if (filename.toLowerCase().endsWith('.png')) contentType = 'image/png';
    else if (filename.toLowerCase().endsWith('.webp')) contentType = 'image/webp';
    else if (filename.toLowerCase().endsWith('.gif')) contentType = 'image/gif';
    else if (filename.toLowerCase().endsWith('.svg')) contentType = 'image/svg+xml';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('API Uploads Error:', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}
