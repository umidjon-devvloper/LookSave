import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { addToBlocklist, getBlocklist, removeFromBlocklist } from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { phone as formatPhone } from '../lib/format';

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

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-white">Qora ro'yxat</h1>
        <p className="mt-1 text-sm text-dim">
          Bu raqamlar do'koningizga buyurtma bera olmaydi. Uchta do'kon bir raqamni bloklasa, u
          barcha do'konlarda bloklanadi.
        </p>
      </div>

      <form
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <label className="flex-1">
          <span className="label">Telefon</span>
          <input
            className="field mt-2"
            value={phoneValue}
            onChange={(event) => setPhoneValue(event.target.value)}
            placeholder="+998901234567"
            required
          />
        </label>
        <label className="flex-1">
          <span className="label">Sabab</span>
          <input
            className="field mt-2"
            value={reason}
            minLength={3}
            maxLength={300}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Masalan: uch marta kelmadi"
            required
          />
        </label>
        <button type="submit" className="btn-primary" disabled={add.isPending}>
          Bloklash
        </button>
      </form>

      {add.isError ? (
        <p className="text-sm text-danger">
          {add.error instanceof Error ? add.error.message : "Qo'shib bo'lmadi"}
        </p>
      ) : null}

      {list.isLoading ? <Spinner /> : null}
      {list.isError ? (
        <ErrorState message="Ro'yxatni yuklab bo'lmadi" onRetry={() => void list.refetch()} />
      ) : null}
      {list.data?.length === 0 ? (
        <EmptyState
          title="Qora ro'yxat bo'sh"
          hint="Buyurtmani rad etayotganda ham raqamni bloklash mumkin."
        />
      ) : null}

      {list.data && list.data.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-dim">
                <th className="px-4 py-2.5 font-medium">Telefon</th>
                <th className="px-4 py-2.5 font-medium">Sabab</th>
                <th className="px-4 py-2.5 font-medium">Qo'shilgan</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.data.map((entry, index) => (
                <tr key={entry.id} className={index % 2 === 0 ? 'bg-surface' : 'bg-surface2'}>
                  <td className="px-4 py-3 font-medium text-white">{formatPhone(entry.phone)}</td>
                  <td className="px-4 py-3 text-muted">
                    {entry.reason}
                    {entry.isGlobal ? (
                      <span className="ml-2 rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] text-danger">
                        barcha do'konlarda
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-dim">
                    {new Date(entry.createdAt).toLocaleDateString('uz-UZ')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.isGlobal ? (
                      <span className="text-xs text-dim">o'chirib bo'lmaydi</span>
                    ) : (
                      <button
                        type="button"
                        className="text-sm text-accent hover:underline"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(entry.id)}
                      >
                        Chiqarish
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
