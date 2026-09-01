import { Form, data, useNavigation, useRouteLoaderData } from 'react-router';

import {
  Button,
  Card,
  ChestIcon,
  HeightIcon,
  HipsIcon,
  Icon,
  ShoeIcon,
  TapeIcon,
  WaistIcon,
  WeightIcon,
  type MeasureIconProps,
} from '@looksave/ui-web';

import { updateMeasurements } from '@/api/endpoints';
import { isLocale } from '@/i18n/locale';
import { requireAuth } from '@/session.server';

import type { Route } from './+types/measurements';
import type { loader as profileLoader } from '@/layouts/profile';

/**
 * O'lchovlar — docs/15-sayt-dizayn.md §4.10.
 *
 * ⚠️ MAYDONLAR VA CHEGARALAR ILOVADAGIDEK, chunki ular bitta zod
 * sxemasidan keladi (`packages/validation/src/auth.ts`,
 * `measurementsSchema`). Chegarani bu yerda «yumshatib» qo'yish
 * serverdan 422 oladi va xato maydon ostida emas, tepada chiqadi.
 *
 * ⚠️ `morphTargets` SERVERDA HISOBLANADI (03-api-spec §6) — sayt uni
 * faqat ko'rsatadi. Formulani bu yerda takrorlash model o'zgarganda
 * ikki joyda tuzatishni talab qilardi.
 */

interface MeasureField {
  key: 'height' | 'weight' | 'chest' | 'waist' | 'hips' | 'shoeSize';
  label: string;
  hint: string;
  unit: string;
  icon: (props: MeasureIconProps) => JSX.Element;
}

/** Ilovadagi `settings/measurements.tsx` dagi ro'yxat bilan bir xil */
const FIELDS: MeasureField[] = [
  { key: 'height', label: "Bo'y", hint: '120–220', unit: 'sm', icon: HeightIcon },
  { key: 'weight', label: 'Vazn', hint: '30–200', unit: 'kg', icon: WeightIcon },
  { key: 'chest', label: "Ko'krak · eng keng joyi", hint: '50–180', unit: 'sm', icon: ChestIcon },
  { key: 'waist', label: 'Bel · eng ingichka joyi', hint: '40–180', unit: 'sm', icon: WaistIcon },
  { key: 'hips', label: 'Son · eng keng joyi', hint: '50–180', unit: 'sm', icon: HipsIcon },
  { key: 'shoeSize', label: "Oyoq o'lchami", hint: '30–50', unit: 'EU', icon: ShoeIcon },
];

const MORPH_LABELS: Array<{ key: string; label: string }> = [
  { key: 'height', label: "Bo'y" },
  { key: 'weight', label: 'Hajm' },
  { key: 'shoulderWidth', label: 'Yelka' },
  { key: 'chest', label: "Ko'krak" },
  { key: 'waist', label: 'Bel' },
  { key: 'hips', label: 'Son' },
];

export function meta(): Route.MetaDescriptors {
  return [{ title: "O'lchovlar — LookSave" }, { name: 'robots', content: 'noindex' }];
}

export async function action({ params, request }: Route.ActionArgs) {
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const context = await requireAuth(request, locale);

  const form = await request.formData();
  const input: Record<string, number> = {};

  for (const field of FIELDS) {
    const raw = String(form.get(field.key) ?? '').trim();
    if (raw === '') continue;

    const value = Number(raw);
    if (Number.isFinite(value)) input[field.key] = value;
  }

  if (Object.keys(input).length === 0) {
    return data({ error: "Kamida bitta o'lcham kiriting", saved: false }, { status: 400 });
  }

  try {
    await updateMeasurements(input, context.options);
  } catch (error) {
    /*
     * Server xato matnini beradi («Bo'y 120 dan kichik bo'lishi mumkin
     * emas») — umumiy xabar o'rniga o'shani ko'rsatamiz.
     */
    return data(
      { error: error instanceof Error ? error.message : "Saqlab bo'lmadi", saved: false },
      { status: 400 },
    );
  }

  return data(
    { error: null as string | null, saved: true },
    context.setCookie ? { headers: { 'Set-Cookie': context.setCookie } } : undefined,
  );
}

export default function Measurements({ actionData }: Route.ComponentProps): JSX.Element {
  const parent = useRouteLoaderData<typeof profileLoader>('layouts/profile');
  const navigation = useNavigation();

  const measurements = parent?.profile?.measurements ?? {};
  const morphs = parent?.profile?.morphTargets ?? {};
  const hasMorphs = Object.keys(morphs).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primarySoft text-brand">
            <TapeIcon size={20} />
          </span>
          <div>
            <h2 className="text-h3 font-semibold">O'lchovlaringiz</h2>
            <p className="mt-1 max-w-[52ch] text-small text-muted-foreground">
              Avatar shakli va o'lcham maslahati shulardan chiqadi. Hammasi shart emas — nechtasini
              bersangiz, avatar shuncha aniq bo'ladi.
            </p>
          </div>
        </div>

        <Form method="post" className="mt-6 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => {
              const IconGlyph = field.icon;
              const current = measurements[field.key];

              return (
                <label key={field.key} className="group flex flex-col gap-2">
                  <span className="flex items-center gap-2 text-label font-semibold uppercase text-dim transition-colors group-focus-within:text-brand">
                    <IconGlyph size={16} />
                    {field.label}
                  </span>

                  <span className="relative">
                    <input
                      name={field.key}
                      inputMode="numeric"
                      defaultValue={current ?? ''}
                      placeholder={field.hint}
                      className="h-control w-full rounded-md border border-border bg-surface ps-4 pe-14 text-body text-foreground transition-colors placeholder:text-dim focus:border-borderAccent focus:bg-surface2 focus:outline-none"
                    />
                    {/* Birlik maydon ichida — ilovadagidek */}
                    <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-small text-dim">
                      {field.unit}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <Button type="submit" loading={navigation.state === 'submitting'}>
              Saqlash
            </Button>

            {actionData?.saved ? (
              <span className="flex items-center gap-1.5 text-small text-success">
                <Icon name="authentic" size={14} />
                Saqlandi
              </span>
            ) : null}
          </div>

          {actionData?.error ? <p className="text-small text-danger">{actionData.error}</p> : null}
        </Form>
      </Card>

      {/* ── Avatar shakli ── */}
      {hasMorphs ? (
        <Card className="p-6">
          <h2 className="text-label font-semibold uppercase text-dim">Avatar shakli</h2>
          <p className="mt-2 text-small text-muted-foreground">
            O'lchovlaringizdan hisoblangan. Kiyintirishda avatar aynan shu nisbatlarda chiziladi.
          </p>

          <dl className="mt-5 flex flex-col gap-3">
            {MORPH_LABELS.map((morph) => {
              const value = morphs[morph.key] ?? 0.5;
              return (
                <div key={morph.key} className="flex items-center gap-3">
                  <dt className="w-20 shrink-0 text-small text-muted-foreground">{morph.label}</dt>
                  <dd className="flex-1">
                    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface2">
                      <span
                        className="block h-full rounded-full bg-primary-grad"
                        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
                      />
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        </Card>
      ) : null}
    </div>
  );
}
