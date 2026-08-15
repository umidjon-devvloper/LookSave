import { useEffect, useState } from 'react';

interface Props {
  title: string;
  description: string;
  actionLabel: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

/**
 * Rad etish va to'xtatishda sabab MAJBURIY — do'kon nima uchun rad
 * etilganini bilishi kerak, aks holda qayta yuboraveradi.
 */
export function ReasonModal({
  title,
  description,
  actionLabel,
  busy,
  onCancel,
  onSubmit,
}: Props): JSX.Element {
  const [reason, setReason] = useState('');

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
      aria-labelledby="reason-title"
    >
      <div className="card w-full max-w-md p-5">
        <h2 id="reason-title" className="text-lg font-semibold text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm text-dim">{description}</p>

        <label className="mt-4 block">
          <span className="label">Sabab</span>
          <textarea
            className="field mt-2 min-h-24"
            value={reason}
            minLength={3}
            maxLength={500}
            autoFocus
            onChange={(event) => setReason(event.target.value)}
            placeholder="Aniq yozing — do'kon shu matnni ko'radi"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>
            Bekor
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={busy || reason.trim().length < 3}
            onClick={() => onSubmit(reason.trim())}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
