import { CheckCircle2, Loader2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Grid } from '@/components/Grid';
import { Reveal } from '@/components/Reveal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      toast.success('You are on the list', { description: `We will write to ${email}.` });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setState('error');
      setMessage(text);
      toast.error('Could not sign you up', { description: text });
    }
  };

  return (
    <section
      id="waitlist"
      className="relative overflow-hidden border-t border-border py-24 sm:py-32"
    >
      <Grid />

      <div className="shell relative max-w-3xl text-center">
        <Reveal>
          <p className="eyebrow">Early access</p>
          <h2 className="headline mt-4 text-3xl sm:text-4xl">Be first to try it on</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            We are opening LookSave to a small group first — shoppers who want the fit solved, and
            stores who are tired of paying for returns.
          </p>
        </Reveal>

        <Reveal delay={120}>
          {state === 'done' ? (
            <Alert className="mx-auto mt-10 max-w-md border-success/40 bg-success/[0.08] text-left">
              <CheckCircle2 className="size-4 text-success" />
              <AlertDescription className="text-muted-foreground">
                <span className="block font-semibold text-foreground">You are on the list</span>
                We will write to {email} when your invite is ready.
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
                      I want to shop
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="store"
                      className="rounded-full border border-border data-[state=on]:border-primary/60 data-[state=on]:bg-primary/15 data-[state=on]:text-foreground"
                    >
                      I have a store
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <div className="mt-5 space-y-2">
                    <Label htmlFor="waitlist-name">
                      {role === 'store' ? 'Store name' : 'Name'}
                    </Label>
                    <Input
                      id="waitlist-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete={role === 'store' ? 'organization' : 'name'}
                      placeholder={role === 'store' ? 'Atelier Noor' : 'Your name'}
                      className="h-11 bg-background"
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="waitlist-email">Email</Label>
                    <Input
                      id="waitlist-email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="h-11 bg-background"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={state === 'sending'}
                    className="mt-6 w-full rounded-full shadow-glow"
                  >
                    {state === 'sending' ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Request an invite'
                    )}
                  </Button>

                  {state === 'error' ? (
                    <p className="mt-4 text-sm text-destructive">{message}</p>
                  ) : (
                    <p className="mt-4 text-center text-xs text-dim">
                      No newsletter. One email when your invite opens.
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
