import type { JSX } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Spinner } from './components/Spinner';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/Login';
import { QueuePage } from './pages/Queue';

/**
 * `developer_ai` paneli — operator navbati.
 *
 * ⚠️ ADMIN PANELDAN ATAYIN AJRATILGAN. Operator do'konlar, buyurtmalar va
 * moderatsiyani ko'rmasligi kerak — uning ishi faqat navbat. Hozircha
 * server `admin` rolini talab qiladi (alohida `operator` roli keyingi
 * qadam); ajratish esa interfeysda shu yerdan boshlanadi.
 */
export function App(): JSX.Element {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <Spinner label="Sessiya tekshirilmoqda" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (user.role !== 'admin') {
    return (
      <main className="flex min-h-full items-center justify-center px-4 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="text-lg font-semibold text-foreground">Bu panel operatorlar uchun</h1>
          <p className="text-sm text-dim">
            Siz <span className="text-foreground">{user.fullName ?? 'boshqa akkaunt'}</span> bilan
            kirgansiz. Chiqib, operator login/paroli bilan kiring.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Chiqish va qayta kirish
          </button>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route index element={<QueuePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
