import { useEffect, useState } from 'react';

import type { RejectReason } from '../../api/store';
import { phone as formatPhone } from '../../lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const REASONS: Array<{ value: RejectReason; label: string }> = [
  { value: 'out_of_stock', label: 'Mahsulot tugagan' },
  { value: 'size_unavailable', label: "Bu o'lcham yo'q" },
  { value: 'price_changed', label: "Narx o'zgargan" },
  { value: 'fake_order', label: 'Soxta buyurtma' },
  { value: 'other', label: 'Boshqa' },
];

interface Props {
  customerPhone: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: { reason: RejectReason; comment?: string; blockPhone: boolean }) => void;
}

export function RejectModal({ customerPhone, busy, onCancel, onSubmit }: Props): JSX.Element {
  const [reason, setReason] = useState<RejectReason>('out_of_stock');
  const [comment, setComment] = useState('');
  const [blockPhone, setBlockPhone] = useState(false);

  // Soxta buyurtma tanlansa bloklash avtomatik yoqiladi (07-web-panels §4.3)
  useEffect(() => {
    if (reason === 'fake_order') setBlockPhone(true);
  }, [reason]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-title"
    >
      <div className="card w-full max-w-md p-5">
        <h2 id="reject-title" className="text-lg font-semibold text-foreground">
          Buyurtmani rad etish
        </h2>
        <p className="mt-1 text-sm text-dim">Sabab mijozga ko'rsatiladi.</p>

        <fieldset className="mt-4 space-y-2">
          <legend className="label mb-2">Sabab</legend>
          {REASONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
                reason === option.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-surface2 text-muted-foreground hover:border-borderStrong'
              }`}
            >
              <input
                type="radio"
                name="reject-reason"
                className="accent-primary"
                checked={reason === option.value}
                onChange={() => setReason(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block">
          <span className="label">Izoh (ixtiyoriy)</span>
          <Input
            className="mt-2"
            value={comment}
            maxLength={300}
            placeholder="Masalan: raqam ishlamayapti"
            onChange={(event) => setComment(event.target.value)}
          />
        </label>

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface2 p-3">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={blockPhone}
            onChange={(event) => setBlockPhone(event.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">Bu raqamni bloklash</span>
            <span className="mt-0.5 block text-xs text-dim">
              {formatPhone(customerPhone)} shu do'kondan boshqa buyurtma bera olmaydi. Uchta do'kon
              bloklasa — barcha do'konlarda bloklanadi.
            </span>
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onCancel} disabled={busy}>
            Bekor
          </Button>
          <Button
            variant="destructive"
            type="button"

            disabled={busy}
            onClick={() =>
              onSubmit({
                reason,
                ...(comment.trim().length >= 3 ? { comment: comment.trim() } : {}),
                blockPhone,
              })
            }
          >
            Rad etish
          </Button>
        </div>
      </div>
    </div>
  );
}
