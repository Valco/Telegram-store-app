'use client';
import React from 'react';

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()} 
      className="bg-black text-white px-6 py-3 rounded-xl font-bold text-sm w-full hover:bg-neutral-800 transition-colors shadow-lg active:scale-95"
    >
      🖨 Роздрукувати чек
    </button>
  );
}
