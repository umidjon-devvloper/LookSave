import { Navigate, Route, Routes } from 'react-router-dom';

import { Spinner } from './components/Spinner';
import { Shell } from './components/layout/Shell';
import { useAuth } from './hooks/useAuth';
import { AnalyticsPage } from './pages/Analytics';
import { ApplyPage } from './pages/Apply';
import { BlocklistPage } from './pages/Blocklist';
import { DashboardPage } from './pages/Dashboard';
import { LoginPage } from './pages/Login';
import { EditProductPage } from './pages/EditProduct';
import { NewProductPage } from './pages/NewProduct';
import { InvoicesPage } from './pages/Invoices';
import { OrdersPage } from './pages/Orders';
import { ProductsPage } from './pages/Products';
import { SettingsPage } from './pages/Settings';
import { TeamPage } from './pages/Team';
import { TelegramPage } from './pages/Telegram';

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

  // Xaridor kirdi — do'kon arizasi berish yo'li ochiladi.
  // Ilgari bu yerda faqat "bu panel do'konlar uchun" yozuvi turardi va
  // yangi do'kon qo'shishning yagona yo'li SQL edi.
  if (user.role === 'customer') {
    return (
      <Routes>
        <Route path="/apply" element={<ApplyPage />} />
        <Route
          path="*"
          element={
            <main className="flex min-h-full items-center justify-center px-4 text-center">
              <div className="max-w-sm space-y-3">
                <h1 className="text-lg font-semibold text-foreground">Bu panel do'konlar uchun</h1>
                <p className="text-sm text-dim">
                  Xarid qilish uchun LookSave mobil ilovasidan foydalaning.
                </p>
                <a
                  href="/apply"
                  className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-foreground"
                >
                  Do'kon ochmoqchimisiz?
                </a>
              </div>
            </main>
          }
        />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<NewProductPage />} />
        <Route path="products/:id" element={<EditProductPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="blocklist" element={<BlocklistPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="telegram" element={<TelegramPage />} />
        {/* Do'kon egasi bo'lib, lekin do'koni hali tasdiqlanmagan holat */}
        <Route path="apply" element={<ApplyPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
