import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { ApiClientError } from '../api/client';
import { applyForStore, getMyApplication, type StoreApplication } from '../api/store';
import { LocationPicker } from '../components/LocationPicker';
import { Spinner } from '../components/Spinner';
import { defaultCenter, isValid, TASHKENT } from '../lib/coords';

/**
 * Do'kon arizasi.
 *
 * ⚠️ Bu ekran hujjatda yo'q edi — 07-web-panels do'kon allaqachon
 * mavjud deb hisoblaydi. Shu vaqtgacha do'konlar SQL bilan qo'lda
 * qo'shilgan, bu esa pilot do'konlar sonini oshirishga to'sqinlik qiladi.
 *
 * Nuqta xaritadan tanlanadi (`LocationPicker`). Xarita kaliti
 * sozlanmagan bo'lsa koordinata qo'lda kiritiladi — sahifa baribir
 * ishlaydi.
 */

const EMPTY: StoreApplication = {
  name: '',
  phone: '+998',
  address: '',
  city: '',
  country: 'UZ',
  location: TASHKENT,
  currency: 'UZS',
  deliveryEnabled: true,
  pickupEnabled: true,
};

const STATUS_TEXT: Record<string, { title: string; body: string }> = {
  pending: {
    title: 'Ariza ko`rib chiqilmoqda',
    body: 'Odatda 1-2 ish kuni. Shu vaqt ichida mahsulotlaringizni qo`shib qo`yishingiz mumkin — do`kon tasdiqlangach ular darhol ko`rinadi.',
  },
  suspended: {
    title: 'Do`kon vaqtincha to`xtatilgan',
    body: 'Batafsil ma`lumot uchun qo`llab-quvvatlashga murojaat qiling.',
  },
};

export function ApplyPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StoreApplication>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const application = useQuery({ queryKey: ['my-application'], queryFn: getMyApplication });

  const submit = useMutation({
    mutationFn: (input: StoreApplication) => applyForStore(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-application'] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiClientError ? err.message : 'Ariza yuborilmadi');
    },
  });

  if (application.isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner label="Tekshirilmoqda" />
      </div>
    );
  }

  const current = application.data;

  if (current?.exists === true && current.status !== 'rejected') {
    const text = STATUS_TEXT[current.status];

    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-bold text-foreground">{current.name}</h1>
        <p className="mt-1 text-sm text-dim">{current.slug}</p>

        {text ? (
          <div className="mt-6 rounded-lg border border-border bg-surface p-4">
            <p className="font-semibold text-foreground">{text.title}</p>
            <p className="mt-2 text-sm text-dim">{text.body}</p>
          </div>
        ) : null}
      </main>
    );
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    setError(null);

    if (!isValid(form.location)) {
      setError('Koordinata noto`g`ri. Xaritadan nuqta tanlang.');
      return;
    }

    submit.mutate(form);
  }

  const rejected = current?.exists === true && current.status === 'rejected';

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold text-foreground">Do`kon ro`yxatdan o`tkazish</h1>
      <p className="mt-2 text-sm text-dim">
        Ariza admin tomonidan ko`rib chiqiladi. Komissiya yo`q, ro`yxatdan o`tish bepul.
      </p>

      {rejected && current.rejectReason ? (
        <div className="mt-6 rounded-lg border border-danger bg-surface p-4">
          <p className="font-semibold text-danger">Oldingi ariza rad etilgan</p>
          <p className="mt-2 text-sm text-dim">{current.rejectReason}</p>
          <p className="mt-2 text-sm text-dim">Tuzatib qayta yuboring.</p>
        </div>
      ) : null}

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <Text
          label="Do`kon nomi"
          value={form.name}
          onChange={(value) => setForm((previous) => ({ ...previous, name: value }))}
          placeholder="Chilonzor Fashion"
          required
        />

        <Text
          label="Telefon"
          value={form.phone}
          onChange={(value) => setForm((previous) => ({ ...previous, phone: value }))}
          placeholder="+998901234567"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Davlat"
            value={form.country}
            options={[
              { value: 'UZ', label: 'O`zbekiston' },
              { value: 'AE', label: 'BAA' },
            ]}
            onChange={(value) =>
              setForm((previous) => ({
                ...previous,
                country: value as 'UZ' | 'AE',
                // Valyuta davlatga bog'liq — noto'g'ri juftlik buyurtmada
                // pul hisobini buzadi
                currency: value === 'AE' ? 'AED' : 'UZS',
                // Xarita ham yangi davlat markaziga ko'chadi, aks holda
                // Dubay do'koni Toshkentdan nuqta qidirib o'tiradi
                location: defaultCenter(value as 'UZ' | 'AE'),
              }))
            }
          />

          <Text
            label="Shahar"
            value={form.city}
            onChange={(value) => setForm((previous) => ({ ...previous, city: value }))}
            placeholder="Toshkent"
            required
          />
        </div>

        <Text
          label="Manzil"
          value={form.address}
          onChange={(value) => setForm((previous) => ({ ...previous, address: value }))}
          placeholder="Chilonzor 19, 5-uy"
          required
        />

        <Text
          label="Mo`ljal (ixtiyoriy)"
          value={form.landmark ?? ''}
          onChange={(value) => setForm((previous) => ({ ...previous, landmark: value }))}
          placeholder="Metro yonida"
        />

        <LocationPicker
          // Davlat almashganda tanlagich qayta quriladi: uning ichidagi
          // matn maydoni boshlang'ich qiymatdan olinadi va o'zi
          // yangilanmaydi
          key={form.country}
          value={form.location}
          onChange={(location) => setForm((previous) => ({ ...previous, location }))}
          hint="Yetkazib berish radiusi shu nuqtadan o`lchanadi. Xato bo`lsa yaqin mijozlar ham sizni topmaydi."
        />

        <div className="space-y-2">
          <Check
            label="Yetkazib berish"
            checked={form.deliveryEnabled}
            onChange={(checked) =>
              setForm((previous) => ({ ...previous, deliveryEnabled: checked }))
            }
          />
          <Check
            label="Do`kondan olib ketish"
            checked={form.pickupEnabled}
            onChange={(checked) => setForm((previous) => ({ ...previous, pickupEnabled: checked }))}
          />
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={submit.isPending || (!form.deliveryEnabled && !form.pickupEnabled)}
          className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-foreground disabled:opacity-50"
        >
          {submit.isPending ? 'Yuborilmoqda…' : 'Arizani yuborish'}
        </button>

        {!form.deliveryEnabled && !form.pickupEnabled ? (
          <p className="text-sm text-danger">Kamida bitta usul tanlanishi kerak</p>
        ) : null}
      </form>
    </main>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}): JSX.Element {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-dim">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
        value={value}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-dim">{label}</span>
      <select
        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-border bg-surface"
      />
      {label}
    </label>
  );
}
