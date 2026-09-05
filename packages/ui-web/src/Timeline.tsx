import { cn } from './cn';

/**
 * Buyurtma holati vaqt chizig'i — docs/15-sayt-dizayn.md §4.9.
 *
 * ⚠️ JORIY QADAM NURLANADI, o'tganlari yashil, kelajagi kulrang. Faqat
 * rang bilan ajratish yetarli emas: rangni ajratmaydigan odam qaysi
 * bosqichda ekanini bilmay qoladi. Shuning uchun joriy qadam KATTAROQ
 * va matni oq — shakl va kontrast ham farq qiladi.
 *
 * ⚠️ MUVAFFAQIYATSIZ TUGASH CHIZIQNI UZADI. «Rad etildi» ni oxirgi
 * qadam qilib qo'yish noto'g'ri bo'lardi — u ketma-ketlikning davomi
 * emas, uzilishi. Shuning uchun `failed` alohida holat.
 */

export type TimelineState = 'done' | 'current' | 'upcoming' | 'failed';

export interface TimelineStep {
  key: string;
  label: string;
  state: TimelineState;
  /** Qadam ostidagi qo'shimcha yozuv — sana yoki sabab */
  hint?: string | undefined;
}

export function Timeline({
  steps,
  className,
}: {
  steps: TimelineStep[];
  className?: string;
}): JSX.Element {
  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;

        return (
          <li key={step.key} className="flex gap-4">
            {/* Belgi va uni keyingisiga ulaydigan chiziq */}
            <div className="flex flex-col items-center">
              <Dot state={step.state} />

              {!last ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'w-px flex-1',
                    step.state === 'done' ? 'bg-success/50' : 'bg-border',
                  )}
                />
              ) : null}
            </div>

            <div className={cn('pb-6', last && 'pb-0')}>
              <p
                className={cn(
                  'text-body',
                  step.state === 'current' && 'font-medium text-foreground',
                  step.state === 'done' && 'text-muted-foreground',
                  step.state === 'upcoming' && 'text-dim',
                  step.state === 'failed' && 'font-medium text-danger',
                )}
              >
                {step.label}
              </p>

              {step.hint ? <p className="mt-0.5 text-small text-dim">{step.hint}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Dot({ state }: { state: TimelineState }): JSX.Element {
  if (state === 'current') {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary shadow-glow">
        <span className="size-1.5 rounded-full bg-primary-foreground" />
      </span>
    );
  }

  if (state === 'failed') {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-danger bg-danger/15">
        <span className="size-1.5 rounded-full bg-danger" />
      </span>
    );
  }

  if (state === 'done') {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success/20">
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 6.5 5 9l4.5-5.5"
            stroke="#22C55E"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return <span className="size-5 shrink-0 rounded-full border border-border bg-surface" />;
}
