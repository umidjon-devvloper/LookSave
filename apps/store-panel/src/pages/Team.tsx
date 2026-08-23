import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiClientError } from '../api/client';
import {
  addMember,
  getMembers,
  removeMember,
  updateMemberRole,
  type MemberRole,
} from '../api/store';
import { ErrorState, Spinner } from '../components/Spinner';
import { phone as formatPhone } from '../lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ROLES: Array<{ value: MemberRole; label: string; hint: string }> = [
  { value: 'manager', label: 'Menejer', hint: 'buyurtma va mahsulotlar' },
  { value: 'staff', label: 'Xodim', hint: 'faqat buyurtmalar' },
];

const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Egasi',
  manager: 'Menejer',
  staff: 'Xodim',
};

export function TeamPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('+998');
  const [role, setRole] = useState<MemberRole>('staff');
  const [error, setError] = useState<string | null>(null);

  const members = useQuery({ queryKey: ['store', 'members'], queryFn: getMembers });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['store', 'members'] });
  };

  const add = useMutation({
    mutationFn: () => addMember(phone.replace(/\s/g, ''), role),
    onSuccess: () => {
      setPhone('+998');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Qo'shib bo'lmadi"),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, next }: { id: string; next: MemberRole }) => updateMemberRole(id, next),
    onSuccess: invalidate,
  });

  const remove = useMutation({ mutationFn: removeMember, onSuccess: invalidate });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Jamoa</h1>
        <p className="mt-1 text-sm text-dim">
          Xodimlar buyurtmalarga javob bera oladi. Javob tezligi qidiruv reytingiga ta'sir qiladi —
          bitta odam 24 soat kutib o'tira olmaydi.
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
          <Input
            className="mt-2"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+998901234567"
            required
          />
        </label>

        <label className="sm:w-48">
          <span className="label">Rol</span>
          <select
            className="field mt-2"
            value={role}
            onChange={(event) => setRole(event.target.value as MemberRole)}
          >
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </option>
            ))}
          </select>
        </label>

        <Button type="submit" disabled={add.isPending}>
          Qo'shish
        </Button>
      </form>

      <p className="text-xs text-dim">
        Xodim avval LookSave ilovasida ro'yxatdan o'tishi kerak — shundan keyin uni telefon raqami
        bo'yicha qo'shasiz. Paroli o'zida qoladi.
      </p>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {members.isLoading ? <Spinner /> : null}
      {members.isError ? (
        <ErrorState message="Yuklab bo'lmadi" onRetry={() => void members.refetch()} />
      ) : null}

      {members.data && members.data.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-dim">
                <th className="px-4 py-2.5 font-medium">Xodim</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Oxirgi faollik</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {members.data.map((member, index) => (
                <tr key={member.id} className={index % 2 === 0 ? 'bg-surface' : 'bg-surface2'}>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{member.fullName ?? '—'}</p>
                    <p className="text-xs text-dim">{formatPhone(member.phone)}</p>
                  </td>

                  <td className="px-4 py-3">
                    {member.isStoreOwner ? (
                      <span className="text-muted-foreground">{ROLE_LABEL.owner}</span>
                    ) : (
                      <select
                        className="field py-1.5 text-sm"
                        value={member.role}
                        disabled={changeRole.isPending}
                        onChange={(event) =>
                          changeRole.mutate({
                            id: member.id,
                            next: event.target.value as MemberRole,
                          })
                        }
                      >
                        {ROLES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-dim">
                    {member.lastActiveAt
                      ? new Date(member.lastActiveAt).toLocaleDateString('uz-UZ')
                      : 'hali kirmagan'}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {member.isStoreOwner ? (
                      <span className="text-xs text-dim">o'chirib bo'lmaydi</span>
                    ) : (
                      <Button
                        variant="link"
                        size="sm"
                        type="button"
                        className="h-auto p-0 text-sm text-dim hover:text-danger"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(member.id)}
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
      ) : null}
    </div>
  );
}
