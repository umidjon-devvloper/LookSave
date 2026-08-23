import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui ning barcha komponentlari shu yerdan o'tadi.
 * `clsx` shartli sinflarni yig'adi, `twMerge` esa qarama-qarshi Tailwind
 * sinflarini (masalan `px-4` va `px-6`) oxirgisi foydasiga qisqartiradi —
 * shusiz `className` bilan berilgan tuzatish ishlamay qolardi.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
