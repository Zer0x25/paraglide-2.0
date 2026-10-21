import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { QueryProvider } from './components/QueryProvider';
import { ThemeProvider } from './components/ThemeProvider';
import { AppShell } from './components/AppShell';
import { Toaster } from 'sonner';
import './app/globals.css';

// Lazy loading de páginas para optimizar code-splitting en Vite
const HomePage = lazy(() => import('./app/page'));
const LoginPage = lazy(() => import('./app/login/page'));
const PilotosPage = lazy(() => import('./app/pilotos/page'));
const ReservasPage = lazy(() => import('./app/reservas/page'));
const CalendarioPage = lazy(() => import('./app/calendario/page'));
const MarcacionPage = lazy(() => import('./app/marcacion/page'));
const AnaliticasPage = lazy(() => import('./app/analiticas/page'));
const AuditoriaPage = lazy(() => import('./app/auditoria/page'));
const ConfiguracionPage = lazy(() => import('./app/configuracion/page'));
const AdminUsersPage = lazy(() => import('./app/admin/users/page'));
const AdminModulesPage = lazy(() => import('./app/admin/modules/page'));
const EquiposPage = lazy(() => import('./app/equipos/page'));
const MeteorologiaPage = lazy(() => import('./app/meteorologia/page'));
const ReportesPage = lazy(() => import('./app/reportes/page'));
const PlantillasPage = lazy(() => import('./app/plantillas/page'));
const PantallaPage = lazy(() => import('./app/pantalla/page'));
const DevPage = lazy(() => import('./app/dev/page'));
const OfflinePage = lazy(() => import('./app/~offline/page'));
const VoucherPublicoPage = lazy(() => import('./app/voucher/[id]/page'));
const DeslindePublicoPage = lazy(() => import('./app/deslinde/[id]/page'));

function VoucherRoute() {
  const { id = '' } = useParams<{ id: string }>();
  return <VoucherPublicoPage params={Promise.resolve({ id })} />;
}

function DeslindeRoute() {
  const { id = '' } = useParams<{ id: string }>();
  return <DeslindePublicoPage params={Promise.resolve({ id })} />;
}

function PageLoading() {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );
}

function App() {
  return (
    <QueryProvider>
      <ThemeProvider>
        <BrowserRouter>
          <AppShell>
            <Toaster position="top-right" richColors />
            <Suspense fallback={<PageLoading />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/pilotos" element={<PilotosPage />} />
                <Route path="/reservas" element={<ReservasPage />} />
                <Route path="/calendario" element={<CalendarioPage />} />
                <Route path="/marcacion" element={<MarcacionPage />} />
                <Route path="/analiticas" element={<AnaliticasPage />} />
                <Route path="/auditoria" element={<AuditoriaPage />} />
                <Route path="/configuracion" element={<ConfiguracionPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/modules" element={<AdminModulesPage />} />
                <Route path="/equipos" element={<EquiposPage />} />
                <Route path="/meteorologia" element={<MeteorologiaPage />} />
                <Route path="/reportes" element={<ReportesPage />} />
                <Route path="/plantillas" element={<PlantillasPage />} />
                <Route path="/pantalla" element={<PantallaPage />} />
                <Route path="/dev" element={<DevPage />} />
                <Route path="/~offline" element={<OfflinePage />} />
                <Route path="/voucher/:id" element={<VoucherRoute />} />
                <Route path="/deslinde/:id" element={<DeslindeRoute />} />
                <Route path="*" element={<HomePage />} />
              </Routes>
            </Suspense>
          </AppShell>
        </BrowserRouter>
      </ThemeProvider>
    </QueryProvider>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
