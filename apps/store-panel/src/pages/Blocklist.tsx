import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe2, ShieldBan, ShieldPlus } from 'lucide-react';
import { useState } from 'react';

import { addToBlocklist, getBlocklist, removeFromBlocklist } from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { PageHeader } from '../components/panel/PageHeader';
import { SectionCard } from '../components/panel/SectionCard';
import { StatTile } from '../components/panel/StatTile';
import { phone as formatPhone } from '../lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function BlocklistPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [phoneValue, setPhoneValue] = useState('+998');
  const [reason, setReason] = useState('');

  const list = useQuery({ queryKey: ['store', 'blocklist'], queryFn: getBlocklist });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['store', 'blocklist'] });
  };

  const add = useMutation({
    mutationFn: () => addToBlocklist(phoneValue.replace(/\s/g, ''), reason.trim()),
    onSuccess: () => {
      setPhoneValue('+998');
      setReason('');
      invalidate();
    },
  });

  const remove = useMutation({ mutationFn: removeFromBlocklist, onSuccess: invalidate });

  const entries = list.data ?? [];
  const globalCount = entries.filter((entry) => entry.isGlobal).length;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Qora ro'yxat"
        subtitle="Bu raqamlar do'koningizga buyurtma bera olmaydi. Uchta do'kon bir raqamni bloklasa, u barcha do'konlarda bloklanadi."
      />

      {entries.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <StatTile
            icon={ShieldBan}
            tone="violet"
            label="Bloklangan"
            value={String(entries.length)}
            hint="Sizning do'koningizda"
          />
          {/*
            ⚠️ «Barcha do'konlarda» ALOHIDA KO'RSATILADI, chunki bu qatorlarni
            sotuvchi o'chira olmaydi — ular platforma darajasidagi blok.
            Umumiy songa qo'shib yuborilsa, «nega chiqarib bo'lmayapti?»
            degan savol jadvalga kirmaguncha javobsiz qolardi.
          */}
          <StatTile
            icon={Globe2}
            tone="amber"
            label="Barcha do'konlarda"
            value={String(globalCount)}
            hint={globalCount > 0 ? "Platforma bloki — o'chirib bo'lmaydi" : 'Yo`q'}
          />
        </div>
      ) : null}

      <SectionCard
        icon={ShieldPlus}
        title="Raqamni bloklash"
        description="Buyurtmani rad etayotganda ham raqamni bloklash mumkin."
      >
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate();
          }}
        >
          <label className="flex-1">
            <span className="label">Telefon</span>
            <Input
              className="mt-2"
              value={phoneValue}
              onChange={(event) => setPhoneValue(event.target.value)}
              placeholder="+998901234567"
              required
            />
          </label>
          <label className="flex-1">
            <span className="label">Sabab</span>
            <Input
              className="mt-2"
              value={reason}
              minLength={3}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Masalan: uch marta kelmadi"
              required
            />
          </label>
          <Button type="submit" disabled={add.isPending}>
            Bloklash
          </Button>
        </form>

        {add.isError ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {add.error instanceof Error ? add.error.message : "Qo'shib bo'lmadi"}
          </p>
        ) : null}
      </SectionCard>

      {list.isLoading ? <Spinner /> : null}
      {list.isError ? (
        <ErrorState message="Ro'yxatni yuklab bo'lmadi" onRetry={() => void list.refetch()} />
      ) : null}

      {!list.isLoading && entries.length === 0 ? (
        <EmptyState
          icon={ShieldBan}
          title="Qora ro'yxat bo'sh"
          hint="Buyurtmani rad etayotganda ham raqamni bloklash mumkin."
        />
      ) : null}

      {entries.length > 0 ? (
        <SectionCard icon={ShieldBan} title="Bloklangan raqamlar" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="thead">
                <tr>
                  <th>Telefon</th>
                  <th>Sabab</th>
                  <th>Qo'shilgan</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-surface2/40">
                    <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                      {formatPhone(entry.phone)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.reason}
                      {entry.isGlobal ? (
                        <Badge
                          variant="outline"
                          className="ml-2 rounded-full border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] text-danger"
                        >
                          barcha do'konlarda
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-dim">
                      {new Date(entry.createdAt).toLocaleDateString('uz-UZ')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {entry.isGlobal ? (
                        <span className="text-xs text-dim">o'chirib bo'lmaydi</span>
                      ) : (
                        <Button
                          variant="link"
                          size="sm"
                          type="button"
                          className="h-auto p-0 text-sm text-brand hover:underline"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(entry.id)}
                        >
                          Chiqarish
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
