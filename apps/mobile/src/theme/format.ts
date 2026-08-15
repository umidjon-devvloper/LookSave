/** Pul serverdan string bo'lib keladi va string bo'lib qoladi. */
export function money(amount: string, currency: string): string {
  const [whole = '0'] = amount.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return currency === 'UZS' ? `${grouped} so'm` : `${grouped} ${currency}`;
}

/** Masofa: 850 m · 3.2 km */
export function distance(meters: number | null): string {
  if (meters === null) return '';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function phone(value: string): string {
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(value);
  return match ? `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}` : value;
}
