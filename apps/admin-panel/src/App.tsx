import { Navigate, Route, Routes } from 'react-router-dom';

import { Shell } from './components/Shell';
import { Spinner } from './components/Spinner';
import { useAuth } from './hooks/useAuth';
import { AssetsPage } from './pages/Assets';
import { LoginPage } from './pages/Login';
import { ModerationPage } from './pages/Moderation';
import { OrdersPage } from './pages/Orders';
import { OverviewPage } from './pages/Overview';
import { ProductsPage } from './pages/Products';
import { BrandsPage } from './pages/Brands';
import { StoresPage } from './pages/Stores';

export function App(): JSX.Element {
  const { user, loading } = useAuth();

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

  // Rol serverda ham tekshiriladi — bu faqat noto'g'ri panelga kirganni
  // chalkashtirmaslik uchun.
  if (user.role !== 'admin') {
    return (
      <main className="flex min-h-full items-center justify-center px-4 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-lg font-semibold text-white">Bu panel administratorlar uchun</h1>
          <p className="text-sm text-dim">
            Do'kon egalari uchun alohida kabinet bor: store.looksave.app
          </p>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<OverviewPage />} />
        <Route path="stores" element={<StoresPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="3d" element={<AssetsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="moderation" element={<ModerationPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
