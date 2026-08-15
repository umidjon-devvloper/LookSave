import { useQuery } from '@tanstack/react-query';

import { getTelegramLink } from '../api/store';
import { ErrorState, Spinner } from '../components/Spinner';

export function TelegramPage(): JSX.Element {
  const link = useQuery({ queryKey: ['store', 'telegram'], queryFn: getTelegramLink });

  if (link.isLoading) return <Spinner />;
  if (link.isError || !link.data) {
    return <ErrorState message="Ma'lumotni yuklab bo'lmadi" onRetry={() => void link.refetch()} />;
  }

  const data = link.data;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Telegram</h1>
        <p className="mt-1 text-sm text-dim">
          Yangi buyurtmalar Telegramga keladi. Tugmalar orqali panelni ochmasdan tasdiqlash yoki rad
          etish mumkin.
        </p>
      </div>

      {data.isLinked ? (
        <div className="card space-y-3 p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            Ulangan
          </p>
          <p className="text-sm text-muted">
            Buyurtmalar Telegramga yuborilmoqda.
            {data.linkedAt
              ? ` ${new Date(data.linkedAt).toLocaleDateString('uz-UZ')} dan beri.`
              : ''}
          </p>
          <p className="text-xs text-dim">
            Xabarlar to'xtasa — botni bloklamaganingizni tekshiring va bu sahifani yangilang.
          </p>
        </div>
      ) : (
        <div className="card space-y-4 p-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-warning">
            <span className="h-2 w-2 rounded-full bg-warning" />
            Ulanmagan
          </p>

          <ol className="space-y-3 text-sm text-muted">
            <li>
              <span className="text-white">1.</span> Quyidagi tugmani bosing — Telegram ochiladi.
            </li>
            <li>
              <span className="text-white">2.</span> Botda <b className="text-white">Start</b> ni
              bosing.
            </li>
            <li>
              <span className="text-white">3.</span> Tayyor. Buyurtmalar shu chatga kela boshlaydi.
            </li>
          </ol>

          <a
            className="btn-primary w-full sm:w-auto"
            href={data.botUrl}
            target="_blank"
            rel="noreferrer"
          >
            Telegramda ochish
          </a>

          {data.linkCode ? (
            <div className="rounded-xl border border-border bg-surface2 p-3">
              <p className="label">Ulash kodi</p>
              <p className="mt-1 font-mono text-lg tracking-widest text-white">{data.linkCode}</p>
              <p className="mt-1 text-xs text-dim">
                Kod bir martalik. Botga <code>/start {data.linkCode}</code> deb ham yozish mumkin.
              </p>
            </div>
          ) : null}

          <p className="text-xs text-dim">
            Xodimlaringiz ko'p bo'lsa — guruh yarating, botni qo'shing va kodni o'sha yerda
            yuboring. Barcha xodim buyurtmani ko'radi.
          </p>
        </div>
      )}
    </div>
  );
}
