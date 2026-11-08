import { Apple, CheckCircle2, Mail, Rocket, Store, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Reveal } from '@/components/Reveal';
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
    <section id="waitlist" className="landing-waitlist-showcase">
      <div className="landing-waitlist-glow" aria-hidden="true" />
      <img className="landing-waitlist-phone is-left" src="/img/waitlist-phone-market-v1.png" alt="LookSave mobil market ilovasi" loading="lazy" />
      <img className="landing-waitlist-phone is-right" src="/img/waitlist-phone-tryon-v1.png" alt="LookSave virtual kiyib ko‘rish ilovasi" loading="lazy" />

      <div className="shell landing-waitlist-center">
        <Reveal>
          <p className="landing-section-pill"><Rocket aria-hidden="true" />Erta kirish</p>
          <h2 className="landing-light-headline">Birinchilardan bo‘lib <span>kiyib ko‘ring</span></h2>
          <p className="landing-light-lead">
            LookSave — AI texnologiyasi bilan kiyimlarni onlayn sinab ko‘rish, xarid qilish va o‘z
            uslubingizni yaratish imkonini beradi.
          </p>
        </Reveal>

        <Reveal delay={120}>
          {state === 'done' ? (
            <Alert className="landing-waitlist-success">
              <CheckCircle2 className="size-5 text-success" />
              <AlertDescription>
                <strong>Ro‘yxatga qo‘shildingiz</strong>
                <span>{email} manziliga taklif tayyor bo‘lganda yozamiz.</span>
              </AlertDescription>
            </Alert>
          ) : (
            <Card className="landing-waitlist-card">
              <CardContent>
                <form onSubmit={submit}>
                  <ToggleGroup type="single" value={role} onValueChange={(value) => value && setRole(value as Role)} className="landing-role-toggle">
                    <ToggleGroupItem value="shopper"><UserRound aria-hidden="true" />Xarid qilmoqchiman</ToggleGroupItem>
                    <ToggleGroupItem value="store"><Store aria-hidden="true" />Do‘konim bor</ToggleGroupItem>
                  </ToggleGroup>

                  <Field id="waitlist-name" className="landing-waitlist-field" label={role === 'store' ? 'Do‘kon nomi' : 'Ism'} value={name} onChange={(event) => setName(event.target.value)} autoComplete={role === 'store' ? 'organization' : 'name'} placeholder={role === 'store' ? 'Atelier Noor' : 'Ismingiz'} />
                  <Field id="waitlist-email" className="landing-waitlist-field" label="Email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" placeholder="you@example.com" />

                  <Button type="submit" loading={state === 'sending'} className="landing-waitlist-submit">
                    <Mail aria-hidden="true" />Taklif so‘rash <span aria-hidden="true">→</span>
                  </Button>

                  {state === 'error' ? <p className="landing-waitlist-error">{message}</p> : <p className="landing-waitlist-note">Reklama yo‘q. Taklif ochilganda birinchilardan bo‘lib xabar beramiz.</p>}
                </form>
              </CardContent>
            </Card>
          )}
        </Reveal>

        <div className="landing-app-downloads" aria-label="Ilovani yuklab olish">
          <span>Ilovani yuklab oling</span>
          <div>
            <a href="#waitlist" aria-label="App Store orqali yuklab olish"><Apple aria-hidden="true" /><i><small>Yuklab olish</small>App Store’da</i></a>
            <a href="#waitlist" aria-label="Google Play orqali yuklab olish"><span className="landing-google-play-icon" aria-hidden="true"><b /><b /><b /><b /></span><i><small>Yuklab olish</small>Google Play’da</i></a>
          </div>
        </div>
      </div>
    </section>
  );
}
