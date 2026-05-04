import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decryptJWT } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await decryptJWT(authHeader.split(' ')[1]);
    if (!payload?.userId) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const userId = payload.userId as string;
    const body = await request.json();
    const { cart } = body;

    // Validate request
    if (!Array.isArray(cart)) {
      return NextResponse.json({ error: 'Invalid cart format' }, { status: 400 });
    }

    // Upsert Cart
    let userCart = await prisma.cart.findUnique({
      where: { userId }
    });

    if (!userCart) {
      userCart = await prisma.cart.create({
        data: { userId }
      });
    }

    // Delete existing items
    await prisma.cartItem.deleteMany({
      where: { cartId: userCart.id }
    });

    // Re-create items if any
    if (cart.length > 0) {
      const itemsToCreate = cart.map((item: any) => ({
        cartId: userCart!.id,
        productId: item.productId,
        quantity: item.quantity
      }));
      
      await prisma.cartItem.createMany({
        data: itemsToCreate
      });
    }

    // Force updatedAt bump to indicate abandonment properly
    await prisma.cart.update({
      where: { id: userCart.id },
      data: { updatedAt: new Date() }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cart sync error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
