'use client';

import { useEffect } from 'react';

export default function CartClearer() {
  useEffect(() => {
    localStorage.removeItem('tg_cart');
  }, []);
  return null;
}
