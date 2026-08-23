import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { ApiClientError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginPage(): JSX.Element {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('+998');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const user = await signIn(phone.replace(/\s/g, ''), password);
      if (user.role === 'customer') {
        setError("Bu panel do'konlar uchun. Xaridorlar mobil ilovadan foydalanadi.");
        return;
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Kirib bo'lmadi. Qaytadan urinib ko'ring.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-semibold uppercase tracking-wordmark text-brand">
          LookSave
        </p>
        <h1 className="mt-6 text-center text-2xl font-bold text-foreground">Do'kon kabineti</h1>
        <p className="mt-2 text-center text-sm text-dim">
          Buyurtmalarni qabul qiling va do'koningizni boshqaring.
        </p>

        <form onSubmit={(event) => void submit(event)} className="card mt-8 space-y-4 p-5">
          <label className="block">
            <span className="label">Telefon</span>
            <Input
              className="mt-2"
              type="tel"
              inputMode="tel"
              autoComplete="username"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+998901234567"
              required
            />
          </label>

          <label className="block">
            <span className="label">Parol</span>
            <Input
              className="mt-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Kirilmoqda…' : 'Kirish'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-dim">
          Parolni unutdingizmi? Hozircha administratorga murojaat qiling.
        </p>
      </div>
    </main>
  );
}
