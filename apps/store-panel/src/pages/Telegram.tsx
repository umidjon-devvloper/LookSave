import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Send, Users } from 'lucide-react';

import { getTelegramLink } from '../api/store';
import { ErrorState, Spinner } from '../components/Spinner';
import { PageHeader } from '../components/panel/PageHeader';
import { SectionCard } from '../components/panel/SectionCard';
import { Button } from '@/components/ui/button';

const STEPS = [
  'Quyidagi tugmani bosing — Telegram ochiladi.',
  'Botda Start ni bosing.',
  'Tayyor. Buyurtmalar shu chatga kela boshlaydi.',
];

export function TelegramPage(): JSX.Element {
  const link = useQuery({ queryKey: ['store', 'telegram'], queryFn: getTelegramLink });

  if (link.isLoading) return <Spinner />;
  if (link.isError || !link.data) {
    return <ErrorState message="Ma'lumotni yuklab bo'lmadi" onRetry={() => void link.refetch()} />;
  }

  const data = link.data;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Telegram"
        subtitle="Buyurtmani panelni ochmasdan, to'g'ridan-to'g'ri Telegramdagi tugmalar bilan tasdiqlash mumkin."
        action={
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
              data.isLinked ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
            }`}
          >
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${data.isLinked ? 'bg-success' : 'bg-warning'}`}
            />
            {data.isLinked ? 'Ulangan' : 'Ulanmagan'}
          </span>
        }
      />

      {data.isLinked ? (
        <SectionCard icon={CheckCircle2} title="Ulanish faol">
          <p className="text-sm text-muted-foreground">
            Buyurtmalar Telegramga yuborilmoqda.
            {data.linkedAt
              ? ` ${new Date(data.linkedAt).toLocaleDateString('uz-UZ')} dan beri.`
              : ''}
          </p>
          <p className="mt-2 text-xs text-dim">
            Xabarlar to'xtasa — botni bloklamaganingizni tekshiring va bu sahifani yangilang.
          </p>
        </SectionCard>
      ) : (
        <>
          <SectionCard icon={Send} title="Uch qadamda ulash">
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-1 ring-primary/20"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            {/* `btn-primary` sinfi ta'riflanmagan edi — tugma bo'yalmay
                qolardi. `asChild` uslubni havolaga o'tkazadi. */}
            <Button asChild className="mt-4 w-full sm:w-auto">
              <a href={data.botUrl} target="_blank" rel="noreferrer">
                Telegramda ochish
              </a>
            </Button>
          </SectionCard>

          {data.linkCode ? (
            <SectionCard
              icon={KeyRound}
              title="Ulash kodi"
              description="Kod bir martalik — ishlatilgach yangisi beriladi."
            >
              {/*
                ⚠️ `tracking-widest` va monoshrift — kodni QO'LDA ko'chirish
                uchun. Sotuvchi uni telefondagi Telegramga yozadi, ya'ni
                O/0 va I/1 ni ajratib turishi kerak.
              */}
              <p className="font-mono text-2xl tracking-widest text-foreground">{data.linkCode}</p>
              <p className="mt-2 text-xs text-dim">
                Botga <code className="text-muted-foreground">/start {data.linkCode}</code> deb ham
                yozish mumkin.
              </p>
            </SectionCard>
          ) : null}

          <SectionCard icon={Users} title="Xodimlaringiz ko'p bo'lsa">
            <p className="text-sm text-muted-foreground">
              Guruh yarating, botni qo'shing va kodni o'sha yerda yuboring — barcha xodim buyurtmani
              bir vaqtda ko'radi.
            </p>
          </SectionCard>
        </>
      )}
    </div>
  );
}
