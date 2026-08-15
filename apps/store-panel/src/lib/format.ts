/** Pul — string bo'lib keladi va string bo'lib qoladi. Faqat ko'rinish uchun ajratiladi. */
export function money(amount: string, currency: string): string {
  const [whole = '0'] = amount.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ${currency === 'UZS' ? "so'm" : currency}`;
}

export function phone(value: string): string {
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(value);
  if (match) return `+998 ${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  return value;
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return 'hozirgina';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} daqiqa oldin`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} soat oldin`;
  return `${Math.floor(seconds / 86_400)} kun oldin`;
}

/** 24 soatlik taymer. 6 soatdan kam qolsa shoshilinch (07-web-panels §4.3). */
export function countdown(minutesLeft: number): { text: string; urgent: boolean } {
  const hours = Math.floor(minutesLeft / 60);
  const minutes = minutesLeft % 60;
  return {
    text: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} qoldi`,
    urgent: minutesLeft < 360,
  };
}
