import { Fragment, type ReactNode } from 'react';

/**
 * Tarjima satrini chizish — `routes/terms.tsx` va `routes/support.tsx` uchun.
 *
 * Ikki belgilash bor, boshqasi yo'q:
 *
 *   `**…**`   → `<strong>` (ajratib ko'rsatish)
 *   `{nom}`   → `tokens` dagi tayyor tugun (havola, pochta manzili)
 *
 * ⚠️ HTML EMAS, ATAYIN. Tarjima satrlarini `dangerouslySetInnerHTML`
 * bilan chizish har tarjimani XSS manbaiga aylantirardi; bu yerda matn
 * doim matn bo'lib qoladi, havolalarni esa sahifaning o'zi beradi.
 *
 * ⚠️ `{nom}` NEGA KERAK. Havolaning gapdagi o'rni tilga bog'liq
 * («{email} ga yozing» / «напишите на {email}»). Gapni havola atrofida
 * bo'laklarga bo'lib tarjima qilsak, arabchada so'z tartibi buziladi.
 *
 * Noma'lum `{nom}` O'ZGARISHSIZ chiqadi — sahifada ko'zga tashlanadi va
 * xato darhol seziladi (jimgina yo'qolib qolgandan yaxshi).
 *
 * ⚠️ RANG: `#171323`, `text-foreground` emas — sayt oq fonda, o'sha token
 * esa oq (`routes/privacy.tsx` dagi izohga qarang).
 */
const TOKEN = /(\{[a-z]+\})/;

function withTokens(
  text: string,
  tokens: Record<string, ReactNode>,
  keyPrefix: string,
): ReactNode[] {
  /*
   * Qavsli guruh bilan `split` navbatma-navbat qaytaradi: juft o'rinda
   * oddiy matn, toq o'rinda — `{nom}` ning o'zi.
   */
  return text.split(TOKEN).map((piece, index) => {
    const name = index % 2 === 1 ? piece.slice(1, -1) : null;

    if (name !== null && Object.hasOwn(tokens, name)) {
      return <Fragment key={`${keyPrefix}-${index}`}>{tokens[name]}</Fragment>;
    }

    return piece;
  });
}

export function rich(text: string, tokens: Record<string, ReactNode> = {}): ReactNode[] {
  // Toq o'rindagi bo'laklar `**…**` ichida turgan matn
  return text.split('**').flatMap<ReactNode>((part, index): ReactNode[] => {
    const nodes = withTokens(part, tokens, String(index));

    return index % 2 === 1
      ? [
          <strong key={index} className="text-[#171323]">
            {nodes}
          </strong>,
        ]
      : nodes;
  });
}
