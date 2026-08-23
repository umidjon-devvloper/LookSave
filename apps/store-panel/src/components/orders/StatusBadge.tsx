import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Buyurtma holati.
 *
 * shadcn `Badge` ning `outline` varianti ustiga rang qo'yiladi: shakl,
 * o'lcham va fokus halqasi komponentdan keladi, ma'no esa rangdan —
 * shunda holat belgisi butun panelda bir xil ko'rinadi.
 *
 * ⚠️ RANG MA'NO TASHIYDI, BEZAK EMAS. Sariq — javob kutilmoqda, yashil —
 * tugadi, qizil — rad etilgan, kulrang — endi hech narsa talab qilinmaydi.
 * Do'kon egasi ro'yxatga bir qarashda nima qilish kerakligini bilishi kerak.
 */
const STYLES: Record<string, { label: string; className: string }> = {
  new: { label: 'Yangi', className: 'border-warning/30 bg-warning/15 text-warning' },
  seen: { label: "Ko'rildi", className: 'border-borderStrong bg-surface2 text-muted-foreground' },
  confirmed: { label: 'Tasdiqlangan', className: 'border-primary/30 bg-primary/15 text-brand' },
  ready: { label: 'Tayyor', className: 'border-success/30 bg-success/15 text-success' },
  completed: { label: 'Yakunlangan', className: 'border-success/20 bg-success/10 text-success' },
  rejected: { label: 'Rad etilgan', className: 'border-danger/30 bg-danger/15 text-danger' },
  cancelled: { label: 'Bekor qilingan', className: 'border-border bg-surface2 text-dim' },
  expired: { label: 'Javob kelmadi', className: 'border-border bg-surface2 text-dim' },
};

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const style = STYLES[status] ?? {
    label: status,
    className: 'border-border bg-surface2 text-muted-foreground',
  };

  return (
    <Badge
      variant="outline"
      className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', style.className)}
    >
      {style.label}
    </Badge>
  );
}
