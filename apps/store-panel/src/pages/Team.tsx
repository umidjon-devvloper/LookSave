import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';

import { ApiClientError } from '../api/client';
import {
  addMember,
  getMembers,
  removeMember,
  updateMemberRole,
  type MemberRole,
} from '../api/store';
import { EmptyState, ErrorState, Spinner } from '../components/Spinner';
import { PageHeader } from '../components/panel/PageHeader';
import { SectionCard } from '../components/panel/SectionCard';
import { StatTile } from '../components/panel/StatTile';
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

  const list = members.data ?? [];
  const counts = {
    total: list.length,
    managers: list.filter((member) => member.role === 'manager' && !member.isStoreOwner).length,
    staff: list.filter((member) => member.role === 'staff' && !member.isStoreOwner).length,
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Jamoa"
        subtitle="Javob tezligi qidiruv reytingiga ta'sir qiladi — bitta odam 24 soat kutib o'tira olmaydi."
      />

      {list.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={Users} tone="violet" label="Jami" value={String(counts.total)} />
          <StatTile
            icon={ShieldCheck}
            tone="blue"
            label="Menejer"
            value={String(counts.managers)}
            hint="Buyurtma va mahsulotlar"
          />
          <StatTile
            icon={UserPlus}
            tone="green"
            label="Xodim"
            value={String(counts.staff)}
            hint="Faqat buyurtmalar"
          />
        </div>
      ) : null}

      <SectionCard
        icon={UserPlus}
        title="Xodim qo'shish"
        description="Xodim avval LookSave ilovasida ro'yxatdan o'tishi kerak — paroli o'zida qoladi."
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
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+998901234567"
              required
            />
          </label>

          <label className="sm:w-56">
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
      </SectionCard>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {members.isLoading ? <Spinner /> : null}
      {members.isError ? (
        <ErrorState message="Yuklab bo'lmadi" onRetry={() => void members.refetch()} />
      ) : null}

      {!members.isLoading && list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Jamoada faqat siz borsiz"
          hint="Xodim qo'shsangiz buyurtmalarga u ham javob bera oladi — javob vaqti qisqaradi."
        />
      ) : null}

      {list.length > 0 ? (
        <SectionCard icon={Users} title="Xodimlar" padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="thead">
                <tr>
                  <th>Xodim</th>
                  <th>Rol</th>
                  <th>Oxirgi faollik</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {list.map((member) => (
                  <tr key={member.id} className="transition-colors hover:bg-surface2/40">
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
        </SectionCard>
      ) : null}
    </div>
  );
}
