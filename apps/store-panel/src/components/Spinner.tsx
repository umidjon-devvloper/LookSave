import { Button } from '@/components/ui/button';
export function Spinner({ label = 'Yuklanmoqda' }: { label?: string }): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-dim">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-borderStrong border-t-primary"
      />
      {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }): JSX.Element {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <p className="text-base font-semibold text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-dim">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry ? (
        <Button variant="outline" type="button" onClick={onRetry}>
          Qayta urinish
        </Button>
      ) : null}
    </div>
  );
}
