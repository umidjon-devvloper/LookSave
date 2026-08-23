import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiClientError } from '../api/client';
import {
  getStoreProfile,
  updateStoreProfile,
  type StoreProfile,
  type WorkingHour,
} from '../api/store';
import { LocationPicker } from '../components/LocationPicker';
import { ErrorState, Spinner } from '../components/Spinner';
import { ImageUploader } from '../components/products/ImageUploader';
import { TASHKENT } from '../lib/coords';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const DAYS = [
  { day: 1, label: 'Dushanba' },
  { day: 2, label: 'Seshanba' },
  { day: 3, label: 'Chorshanba' },
  { day: 4, label: 'Payshanba' },
  { day: 5, label: 'Juma' },
  { day: 6, label: 'Shanba' },
  { day: 7, label: 'Yakshanba' },
];

function toMap(hours: WorkingHour[]): Record<number, WorkingHour> {
  return Object.fromEntries(hours.map((hour) => [hour.day, hour]));
}

export function SettingsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const store = useQuery({ queryKey: ['store', 'profile'], queryFn: getStoreProfile });

  const [form, setForm] = useState<Partial<StoreProfile>>({});
  const [hours, setHours] = useState<Record<number, WorkingHour>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!store.data) return;
    setForm(store.data);
    setHours(toMap(store.data.workingHours));
  }, [store.data]);

  const save = useMutation({
    mutationFn: () =>
      updateStoreProfile({
        name: form.name,
        description: form.description ?? null,
        phone: form.phone,
        address: form.address,
        landmark: form.landmark ?? null,
        ...(form.location ? { location: form.location } : {}),
        logoUrl: form.logoUrl ?? null,
        coverUrl: form.coverUrl ?? null,
        workingHours: DAYS.map(({ day }) => {
          const hour = hours[day];
          return {
            day,
            open: hour?.open ?? '10:00',
            close: hour?.close ?? '20:00',
            closed: hour?.closed ?? false,
          };
        }),
        ...(form.delivery
          ? {
              deliveryEnabled: form.delivery.enabled,
              deliveryRadiusM: form.delivery.radiusM,
              deliveryFee: form.delivery.fee,
              freeDeliveryFrom: form.delivery.freeFrom,
            }
          : {}),
        pickupEnabled: form.pickupEnabled,
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['store'] });
    },
    onError: (err) => setError(err instanceof ApiClientError ? err.message : "Saqlab bo'lmadi"),
  });

  if (store.isLoading) return <Spinner />;
  if (store.isError || !store.data) {
    return <ErrorState message="Yuklab bo'lmadi" onRetry={() => void store.refetch()} />;
  }

  const update = (patch: Partial<StoreProfile>): void => {
    setSaved(false);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const setHour = (day: number, patch: Partial<WorkingHour>): void => {
    setSaved(false);
    setHours((prev) => ({
      ...prev,
      [day]: {
        day,
        open: prev[day]?.open ?? '10:00',
        close: prev[day]?.close ?? '20:00',
        closed: prev[day]?.closed ?? false,
        ...patch,
      },
    }));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Do'kon sozlamalari</h1>
        <p className="mt-1 text-sm text-dim">
          Hozir: {store.data.isOpen ? 'ochiq' : 'yopiq'}
          {store.data.closesAt ? ` · ${store.data.closesAt} gacha` : ''}
          {store.data.opensAt ? ` · ${store.data.opensAt} da ochiladi` : ''}
        </p>
      </div>

      <section className="card space-y-4 p-5">
        <label className="block">
          <span className="label">Nomi</span>
          <Input
            className="mt-2"
            value={form.name ?? ''}
            onChange={(event) => update({ name: event.target.value })}
          />
        </label>

        <label className="block">
          <span className="label">Tavsif</span>
          <Textarea
            className="mt-2 min-h-20"
            value={form.description ?? ''}
            maxLength={1000}
            onChange={(event) => update({ description: event.target.value })}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Telefon</span>
            <Input
              className="mt-2"
              value={form.phone ?? ''}
              onChange={(event) => update({ phone: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Mo'ljal</span>
            <Input
              className="mt-2"
              value={form.landmark ?? ''}
              placeholder="Mehnat metrosi yonida"
              onChange={(event) => update({ landmark: event.target.value })}
            />
          </label>
        </div>

        <label className="block">
          <span className="label">Manzil</span>
          <Input
            className="mt-2"
            value={form.address ?? ''}
            onChange={(event) => update({ address: event.target.value })}
          />
        </label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-foreground">Logo va muqova</h2>

        <div>
          <p className="label mb-2">Logo</p>
          <ImageUploader
            images={form.logoUrl ? [form.logoUrl] : []}
            max={1}
            purpose="store"
            hint="Kvadrat rasm yaxshi ko'rinadi · WEBP, JPEG yoki PNG"
            onChange={(images) => update({ logoUrl: images[0] ?? null })}
          />
        </div>

        <div>
          <p className="label mb-2">Muqova</p>
          <ImageUploader
            images={form.coverUrl ? [form.coverUrl] : []}
            max={1}
            purpose="store"
            hint="Do'kon sahifasining yuqorisida ko'rinadi · keng rasm tanlang"
            onChange={(images) => update({ coverUrl: images[0] ?? null })}
          />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Joylashuv</h2>
          <p className="mt-1 text-xs text-dim">
            Yetkazib berish radiusi shu nuqtadan o'lchanadi. Xato bo'lsa yaqin mijozlar ham
            "hududdan tashqarida" xatosini oladi.
          </p>
        </div>

        <LocationPicker
          value={form.location ?? TASHKENT}
          onChange={(location) => update({ location })}
          hint="Xaritadan nuqtani bosing yoki markerni suring."
        />

        {form.location ? (
          <a
            className="text-sm text-brand hover:underline"
            href={`https://maps.google.com/?q=${form.location.lat},${form.location.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            Xaritada tekshirish
          </a>
        ) : null}
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold text-foreground">Ish vaqti</h2>

        {DAYS.map(({ day, label }) => {
          const hour = hours[day];
          const closed = hour?.closed ?? false;

          return (
            <div key={day} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-sm text-muted-foreground">{label}</span>

              <Input
                type="time"
                className="w-32 py-2"
                disabled={closed}
                value={hour?.open ?? '10:00'}
                onChange={(event) => setHour(day, { open: event.target.value })}
              />
              <span className="text-dim">—</span>
              <Input
                type="time"
                className="w-32 py-2"
                disabled={closed}
                value={hour?.close ?? '20:00'}
                onChange={(event) => setHour(day, { close: event.target.value })}
              />

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={closed}
                  onChange={(event) => setHour(day, { closed: event.target.checked })}
                />
                Dam olish
              </label>
            </div>
          );
        })}

        <p className="text-xs text-dim">
          Yopilish vaqti ochilishdan kichik bo'lsa — yarim tundan o'tadi (masalan 14:00–02:00).
        </p>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-foreground">Yetkazib berish</h2>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={form.delivery?.enabled ?? false}
            onChange={(event) =>
              update({
                delivery: {
                  enabled: event.target.checked,
                  radiusM: form.delivery?.radiusM ?? 15000,
                  fee: form.delivery?.fee ?? '0.00',
                  freeFrom: form.delivery?.freeFrom ?? null,
                },
              })
            }
          />
          Yetkazib beramiz
        </label>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="accent-primary"
            checked={form.pickupEnabled ?? false}
            onChange={(event) => update({ pickupEnabled: event.target.checked })}
          />
          Do'kondan olib ketish mumkin
        </label>

        {form.delivery?.enabled ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="label">Radius (km)</span>
              <Input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                className="mt-2 tabular-nums"
                value={(form.delivery.radiusM / 1000).toString()}
                onChange={(event) =>
                  update({
                    delivery: {
                      ...form.delivery!,
                      radiusM: Math.round(Number(event.target.value) * 1000),
                    },
                  })
                }
              />
            </label>

            <label className="block">
              <span className="label">Narxi</span>
              <Input
                className="mt-2 tabular-nums"
                inputMode="decimal"
                value={form.delivery.fee}
                onChange={(event) =>
                  update({ delivery: { ...form.delivery!, fee: event.target.value } })
                }
              />
            </label>

            <label className="block">
              <span className="label">Bepul chegara</span>
              <Input
                className="mt-2 tabular-nums"
                inputMode="decimal"
                placeholder="yo'q"
                value={form.delivery.freeFrom ?? ''}
                onChange={(event) =>
                  update({
                    delivery: {
                      ...form.delivery!,
                      freeFrom: event.target.value.trim() === '' ? null : event.target.value,
                    },
                  })
                }
              />
            </label>
          </div>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          type="button"

          disabled={save.isPending}
          onClick={() => {
            setError(null);
            save.mutate();
          }}
        >
          {save.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
        </Button>
        {saved ? <span className="text-sm text-success">Saqlandi</span> : null}
      </div>
    </div>
  );
}
