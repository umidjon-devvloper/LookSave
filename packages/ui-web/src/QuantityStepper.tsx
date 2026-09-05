import { cn } from './cn';

/**
 * Son o'zgartirgich — `−  1  +` (docs/15-sayt-dizayn.md §5, §4.7).
 *
 * ⚠️ RAQAM KENGLIGI QOTIRILGAN (`w-9` + `tabular-nums`). Aks holda
 * 9 dan 10 ga o'tganda tugmalar sakraydi va barmoq «+» ni qidirib
 * qoladi — bu arzon ko'rinishning klassik belgisi.
 *
 * ⚠️ `busy` da tugmalar O'CHADI, lekin raqam ESKISICHA qoladi. Spinner
 * qo'yilsa qator balandligi o'zgarardi va ro'yxat qimirlab ketardi.
 */
export function QuantityStepper({
  value,
  onDecrement,
  onIncrement,
  busy = false,
  min = 1,
  max = 10,
  className,
}: {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  busy?: boolean;
  min?: number;
  max?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('inline-flex items-center gap-1', busy && 'opacity-45', className)}>
      <StepButton label="Kamaytirish" disabled={busy || value <= min} onClick={onDecrement}>
        −
      </StepButton>

      <span className="w-9 text-center text-body tabular-nums text-foreground" aria-live="polite">
        {value}
      </span>

      <StepButton label="Ko'paytirish" disabled={busy || value >= max} onClick={onIncrement}>
        +
      </StepButton>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-9 items-center justify-center rounded-md border border-border text-body text-foreground transition-colors duration-150 hover:bg-surface3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45"
    >
      {children}
    </button>
  );
}
