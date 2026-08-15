const STYLES: Record<string, { label: string; className: string }> = {
  new: { label: 'Yangi', className: 'bg-warning/15 text-warning border-warning/30' },
  seen: { label: "Ko'rildi", className: 'bg-surface2 text-muted border-borderStrong' },
  confirmed: { label: 'Tasdiqlangan', className: 'bg-primary/15 text-accent border-primary/30' },
  ready: { label: 'Tayyor', className: 'bg-success/15 text-success border-success/30' },
  completed: { label: 'Yakunlangan', className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'Rad etilgan', className: 'bg-danger/15 text-danger border-danger/30' },
  cancelled: { label: 'Bekor qilingan', className: 'bg-surface2 text-dim border-border' },
  expired: { label: 'Javob kelmadi', className: 'bg-surface2 text-dim border-border' },
};

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const style = STYLES[status] ?? {
    label: status,
    className: 'bg-surface2 text-muted border-border',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style.className}`}
    >
      {style.label}
    </span>
  );
}
