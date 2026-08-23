import { useRef, useState } from 'react';

import { uploadImage, type UploadPurpose } from '../../api/products';

interface Props {
  images: string[];
  max?: number;
  /** `store` — logo va cover uchun: boshqa yo'lga va boshqa kesh muddatiga tushadi. */
  purpose?: UploadPurpose;
  onChange: (images: string[]) => void;
  hint?: string;
}

/**
 * Rasmlar R2 ga to'g'ridan-to'g'ri yuklanadi. Server faqat imzolangan
 * havola beradi — fayl VPS orqali o'tmaydi.
 */
export function ImageUploader({
  images,
  max = 10,
  purpose = 'product',
  onChange,
  hint,
}: Props): JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;

    setBusy(true);
    setError(null);
    const uploaded: string[] = [];

    try {
      for (const file of Array.from(files).slice(0, max - images.length)) {
        uploaded.push(await uploadImage(file, purpose));
      }
      onChange([...images, ...uploaded]);
    } catch (err) {
      // Bir nechtasi yuklangan bo'lsa ham saqlaymiz — qaytadan yuklash shart emas
      if (uploaded.length > 0) onChange([...images, ...uploaded]);
      setError(err instanceof Error ? err.message : 'Rasm yuklanmadi');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((url, index) => (
          <figure
            key={url}
            className="relative h-24 w-24 overflow-hidden rounded-xl border border-border"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            {index === 0 ? (
              <figcaption className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[10px] text-foreground">
                asosiy
              </figcaption>
            ) : null}
            <button
              type="button"
              aria-label="Rasmni olib tashlash"
              className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-foreground hover:bg-danger"
              onClick={() => onChange(images.filter((item) => item !== url))}
            >
              ×
            </button>
          </figure>
        ))}

        {images.length < max ? (
          <button
            type="button"
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-borderStrong text-xs text-dim transition hover:border-primary hover:text-brand"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? 'Yuklanmoqda…' : '+ Rasm'}
          </button>
        ) : null}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/webp,image/jpeg,image/png"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <p className="mt-2 text-xs text-dim">
        {hint ??
          "WEBP, JPEG yoki PNG · 8 MB gacha · birinchi rasm katalogda ko'rinadi. Nashr qilish uchun kamida 3 ta kerak."}
      </p>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
