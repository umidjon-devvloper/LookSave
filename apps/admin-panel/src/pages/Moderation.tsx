import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getGlobalBlocks, getUsers, removeBlock, unrestrictUser } from '../api/admin';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { phone as formatPhone } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ModerationPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const blocks = useQuery({ queryKey: ['admin', 'blocklist'], queryFn: getGlobalBlocks });
  const users = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () => getUsers(true, search),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  };

  const unblock = useMutation({ mutationFn: removeBlock, onSuccess: invalidate });
  const unrestrict = useMutation({ mutationFn: unrestrictUser, onSuccess: invalidate });

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Global bloklar</h1>
          <p className="mt-1 text-sm text-dim">
            Uch do'kon bir raqamni bloklasa, u avtomatik barcha do'konlarda bloklanadi. Uchala
            do'kon ham xato qilishi mumkin — sabablarni ko'rib qaror qiling.
          </p>
        </div>

        {blocks.isLoading ? <Spinner /> : null}
        {blocks.isError ? (
          <ErrorState message="Yuklab bo'lmadi" onRetry={() => void blocks.refetch()} />
        ) : null}
        {blocks.data?.length === 0 ? <EmptyState title="Global blok yo'q" /> : null}

        <div className="space-y-3">
          {blocks.data?.map((block) => (
            <article key={block.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{formatPhone(block.phone)}</p>
                  <p className="text-xs text-danger">{block.reason}</p>
                </div>
                <Button
                  variant="outline"
                  type="button"

                  disabled={unblock.isPending}
                  onClick={() => unblock.mutate(block.id)}
                >
                  Blokni bekor qilish
                </Button>
              </div>

              {block.storeReasons.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  {block.storeReasons.map((item, index) => (
                    <li key={`${item.store}-${index}`}>
                      {item.store} — “{item.reason}”
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Cheklangan foydalanuvchilar</h2>
            <p className="mt-1 text-sm text-dim">
              Cheklov `user_trust` bo'yicha avtomatik qo'yiladi: uch marta bekor qilingan yoki
              javobsiz buyurtma.
            </p>
          </div>
          <Input
            className="sm:w-56"
            placeholder="Telefon yoki ism"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {users.isLoading ? <Spinner /> : null}
        {users.data?.length === 0 ? <EmptyState title="Cheklangan foydalanuvchi yo'q" /> : null}

        {users.data && users.data.length > 0 ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-dim">
                  <th className="px-4 py-2.5 font-medium">Foydalanuvchi</th>
                  <th className="px-4 py-2.5 font-medium">Buyurtmalar</th>
                  <th className="px-4 py-2.5 font-medium">Sabab</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {users.data.map((user, index) => (
                  <tr key={user.id} className={index % 2 === 0 ? 'bg-surface' : 'bg-surface2'}>
                    <td className="px-4 py-3">
                      <p className="text-foreground">{user.fullName ?? '—'}</p>
                      <p className="text-xs text-dim">{formatPhone(user.phone)}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {user.trust.completed} yakun · {user.trust.cancelled} bekor ·{' '}
                      {user.trust.noshow} kelmadi
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {user.trust.note ?? '—'}
                      {user.trust.restrictedUntil ? (
                        <span className="block text-dim">
                          {new Date(user.trust.restrictedUntil).toLocaleDateString('uz-UZ')} gacha
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="link"
                        size="sm"
                        type="button"
                        className="h-auto p-0 text-sm text-brand hover:underline"
                        disabled={unrestrict.isPending}
                        onClick={() => unrestrict.mutate(user.id)}
                      >
                        Cheklovni olib tashlash
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
