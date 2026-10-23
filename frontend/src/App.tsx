import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import './index.css'

// Public pages (lazy loaded)
const HomePage = lazy(() => import('./public/HomePage'))
const FeaturesPage = lazy(() => import('./public/FeaturesPage'))
const HowItWorksPage = lazy(() => import('./public/HowItWorksPage'))
const DetectionCapabilitiesPage = lazy(() => import('./public/DetectionCapabilitiesPage'))
const PrivacyPage = lazy(() => import('./public/PrivacyPage'))
const ContactPage = lazy(() => import('./public/ContactPage'))
const PublicLayout = lazy(() => import('./public/PublicLayout'))

// Admin pages (lazy loaded)
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const LoginPage = lazy(() => import('./admin/LoginPage'))
const DashboardPage = lazy(() => import('./admin/DashboardPage'))
const LiveMonitorPage = lazy(() => import('./admin/LiveMonitorPage'))
const IncidentsPage = lazy(() => import('./admin/IncidentsPage'))
const IncidentDetailPage = lazy(() => import('./admin/IncidentDetailPage'))
const CamerasPage = lazy(() => import('./admin/CamerasPage'))
const ZonesPage = lazy(() => import('./admin/ZonesPage'))
const RulesPage = lazy(() => import('./admin/RulesPage'))
const AnalyticsPage = lazy(() => import('./admin/AnalyticsPage'))
const UsersPage = lazy(() => import('./admin/UsersPage'))
const AuditLogPage = lazy(() => import('./admin/AuditLogPage'))
const SystemHealthPage = lazy(() => import('./admin/SystemHealthPage'))
const SettingsPage = lazy(() => import('./admin/SettingsPage'))

// Auth context
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './hooks/useToast'

// Admin path slug comes from environment or defaults
const ADMIN_SLUG = import.meta.env.VITE_ADMIN_SLUG || 'ops-console-a1b2c3'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-bg flex items-center justify-center"><div className="skeleton w-8 h-8 rounded-full" /></div>
  if (!user) return <Navigate to={`/${ADMIN_SLUG}/login`} replace />
  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-secondary text-sm">Loading...</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public routes ── */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/how-it-works" element={<HowItWorksPage />} />
                <Route path="/detection-capabilities" element={<DetectionCapabilitiesPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/contact" element={<ContactPage />} />
              </Route>

              {/* ── Admin login (outside AdminLayout) ── */}
              <Route path={`/${ADMIN_SLUG}/login`} element={<LoginPage />} />

              {/* ── Protected admin routes ── */}
              <Route path={`/${ADMIN_SLUG}`} element={
                <AdminGuard><AdminLayout adminSlug={ADMIN_SLUG} /></AdminGuard>
              }>
                <Route index element={<DashboardPage />} />
                <Route path="monitor" element={<LiveMonitorPage />} />
                <Route path="incidents" element={<IncidentsPage />} />
                <Route path="incidents/:id" element={<IncidentDetailPage />} />
                <Route path="cameras" element={<CamerasPage />} />
                <Route path="zones" element={<ZonesPage />} />
                <Route path="rules" element={<RulesPage />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="audit" element={<AuditLogPage />} />
                <Route path="health" element={<SystemHealthPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* 404 — same look as public site */}
              <Route path="*" element={
                <div className="min-h-screen bg-bg flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-6xl font-bold text-accent mb-4">404</h1>
                    <p className="text-secondary">Page not found</p>
                  </div>
                </div>
              } />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
