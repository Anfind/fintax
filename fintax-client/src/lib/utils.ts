import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString('vi-VN');
}

export function formatCompactVND(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(2)} tỷ`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(1)} tr`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(0)}K`;
  return amount.toLocaleString('vi-VN') + ' ₫';
}
