import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const p = searchParams.get('path');
    if (!p) return new NextResponse('No path', { status: 400 });

    const filename = p.replace('/uploads/', '');
    const filePath = path.join(process.cwd(), 'public/uploads', filename);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Not found', { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    let contentType = 'image/jpeg';
    if (filename.toLowerCase().endsWith('.png')) contentType = 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new NextResponse('Error', { status: 500 });
  }
}
