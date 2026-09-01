import { CheckCircle2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Grid } from '@/components/Grid';
import { Reveal } from '@/components/Reveal';
import { SectionBackdrop } from '@/components/SectionBackdrop';
import { Button, Field } from '@looksave/ui-web';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type Role = 'shopper' | 'store';
type State = 'idle' | 'sending' | 'done' | 'error';

export function Waitlist(): JSX.Element {
  const [role, setRole] = useState<Role>('shopper');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (state === 'sending') return;

    setState('sending');
    setMessage('');

    try {
      const response = await fetch('/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || null, role }),
      });

      if (!response.ok) {
        /*
         * Server xato matnini beradi (masalan "bu manzil allaqachon
         * ro'yxatda"). Uni ko'rsatamiz — "xatolik yuz berdi" degan umumiy
         * xabar odamni nima qilishni bilmay qoldiradi.
         */
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `HTTP ${response.status}`);
      }

      setState('done');
      toast.success('Ro‘yxatga qo‘shildingiz', { description: `${email} manziliga yozamiz.` });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setState('error');
      setMessage(text);
      toast.error('Ro‘yxatga qo‘sha olmadik', { description: text });
    }
  };

  return (
    <section id="waitlist" className="section-y relative isolate overflow-hidden">
      {' '}
      {/* Fon rasmi — chetlari fonga singiydi, qo'shni bo'limga tutashadi */}
      <SectionBackdrop src="/img/bg-planet.webp" position="object-bottom" />
      <Grid />
      <div className="shell relative max-w-3xl text-center">
        <Reveal>
          <p className="eyebrow">Erta kirish</p>
          <h2 className="headline mt-4 text-h1">Birinchilardan bo‘lib kiyib ko‘ring</h2>
          <p className="mx-auto mt-5 max-w-xl text-lead text-muted-foreground">
            LookSave avval kichik guruhga ochiladi: o‘lcham muammosini yechmoqchi bo‘lgan xaridorlar
            va qaytarishdan charchagan do‘konlar.
          </p>
        </Reveal>

        <Reveal delay={120}>
          {state === 'done' ? (
            <Alert className="mx-auto mt-10 max-w-md border-success/40 bg-success/[0.08] text-left">
              <CheckCircle2 className="size-4 text-success" />
              <AlertDescription className="text-muted-foreground">
                <span className="block font-semibold text-foreground">Ro‘yxatga qo‘shildingiz</span>
                {email} manziliga taklif tayyor bo‘lganda yozamiz.
              </AlertDescription>
            </Alert>
          ) : (
            <Card className="mx-auto mt-10 max-w-md border-border bg-surface text-left shadow-card">
              <CardContent className="p-6">
                <form onSubmit={submit}>
                  <ToggleGroup
                    type="single"
                    value={role}
                    onValueChange={(value) => value && setRole(value as Role)}
                    className="grid grid-cols-2 gap-2"
                  >
                    <ToggleGroupItem
                      value="shopper"
                      className="rounded-full border border-border data-[state=on]:border-primary/60 data-[state=on]:bg-primary/15 data-[state=on]:text-foreground"
                    >
                      Xarid qilmoqchiman
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="store"
                      className="rounded-full border border-border data-[state=on]:border-primary/60 data-[state=on]:bg-primary/15 data-[state=on]:text-foreground"
                    >
                      Do‘konim bor
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <Field
                    id="waitlist-name"
                    className="mt-5"
                    label={role === 'store' ? 'Do‘kon nomi' : 'Ism'}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete={role === 'store' ? 'organization' : 'name'}
                    placeholder={role === 'store' ? 'Atelier Noor' : 'Ismingiz'}
                  />

                  <Field
                    id="waitlist-email"
                    className="mt-4"
                    label="Email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />

                  <Button
                    type="submit"
                    loading={state === 'sending'}
                    className="mt-6 w-full shadow-glow"
                  >
                    Taklif so‘rash
                  </Button>

                  {state === 'error' ? (
                    <p className="mt-4 text-small text-destructive">{message}</p>
                  ) : (
                    <p className="mt-4 text-center text-tiny text-dim">
                      Reklama yo‘q. Taklif ochilganda bitta xat.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>
          )}
        </Reveal>
      </div>
    </section>
  );
}
