/**
 * shadcn/ui ning barcha komponentlari shu yerdan o'tadi.
 *
 * ⚠️ ENDI O'Z AMALGA OSHIRISHI YO'Q — `@looksave/ui-web` dagisi qayta
 * eksport qilinadi. Sabab: u yerdagi `twMerge` bizning tipografika
 * shkalamiz bilan sozlangan (`text-body`, `text-h1`…). Sozlanmagan
 * variant bu sinflarni RANG deb o'ylaydi va `text-foreground` bilan
 * bitta qatorda uchraganda jimgina o'chirib yuboradi.
 *
 * Ya'ni bu yerda `twMerge(clsx(...))` ni qayta yozish — o'sha xatoni
 * shadcn komponentlariga qaytarish demak.
 */
export { cn } from '@looksave/ui-web';
