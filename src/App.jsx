import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { usePageTitle } from './hooks/usePageTitle'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/appContextCore'
import { AppProvider } from './context/AppContext'
import { ToastProvider } from './context/ToastContext'
import PageErrorBoundary from './components/ui/PageErrorBoundary'
import Auth from './pages/Auth'
import AppShell from './components/layout/AppShell'
import Skeleton from './components/ui/Skeleton'

import { useLocation } from 'react-router-dom'
import { HomeSkeleton, FinanceSkeleton, AnalyticsSkeleton, GeneralSkeleton } from './components/ui/Skeleton'

const Home = lazy(() => import('./pages/Home'))
const Finance = lazy(() => import('./pages/Finance'))
const TimeFlow = lazy(() => import('./pages/TimeFlow'))
const Study = lazy(() => import('./pages/Study'))
const Habits = lazy(() => import('./pages/Habits'))
const Health = lazy(() => import('./pages/Health'))
const Journal = lazy(() => import('./pages/Journal'))
const AIChat = lazy(() => import('./pages/AIChat'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))
const ScoringStudio = lazy(() => import('./pages/ScoringStudio'))
const AnalysisBuilder = lazy(() => import('./pages/AnalysisBuilder'))

const Plan = lazy(() => import('./pages/Plan'))
const Capture = lazy(() => import('./pages/Capture'))
const Me = lazy(() => import('./pages/Me'))
const Wisdom = lazy(() => import('./pages/Wisdom'))
const Goals = lazy(() => import('./pages/Goals'))
const DecisionJournal = lazy(() => import('./pages/DecisionJournal'))
const RelationshipCRM = lazy(() => import('./pages/RelationshipCRM'))
const SecondBrain = lazy(() => import('./pages/SecondBrain'))
const ReadingTracker = lazy(() => import('./pages/ReadingTracker'))
const Meditation = lazy(() => import('./pages/Meditation'))
const YearInReview = lazy(() => import('./pages/YearInReview'))
const FocusMode = lazy(() => import('./pages/FocusMode'))
const SharedDashboard = lazy(() => import('./pages/SharedDashboard'))
const SetupWizard = lazy(() => import('./pages/SetupWizard'))


function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 24,
        background: 'var(--bg-primary)',
      }}
    >
      <div className="brand-mark" aria-hidden="true">L</div>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 800,
          fontSize: 22,
          color: 'var(--accent-indigo)',
        }}
      >
        Life OS
      </div>
      <div style={{ width: 'min(320px, 100%)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton height={80} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, isLoading, isAuthReady } = useAuth()

  if (isLoading || !isAuthReady) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  return children
}

function ShellPage({ children }) {
  const location = useLocation()

  const skeletonFallback = (() => {
    switch (location.pathname) {
      case '/':
        return <HomeSkeleton />
      case '/finance':
        return <FinanceSkeleton />
      case '/analytics':
        return <AnalyticsSkeleton />
      default:
        return <GeneralSkeleton />
    }
  })()

  return (
    <ProtectedRoute>
      <AppProvider>
        <AppShell>
          <PageErrorBoundary>
            <Suspense fallback={skeletonFallback}>{children}</Suspense>
          </PageErrorBoundary>
        </AppShell>
      </AppProvider>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  const { user, isLoading, isAuthReady } = useAuth()
  usePageTitle()

  if (isLoading || !isAuthReady) {
    return <LoadingScreen />
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={<ShellPage><Home /></ShellPage>} />
      <Route path="/plan" element={<ShellPage><Plan /></ShellPage>} />
      <Route path="/capture" element={<ShellPage><Capture /></ShellPage>} />
      <Route path="/insights" element={<ShellPage><Analytics /></ShellPage>} />
      <Route path="/me" element={<ShellPage><Me /></ShellPage>} />
      <Route path="/finance" element={<ShellPage><Finance /></ShellPage>} />
      <Route path="/timeflow" element={<ShellPage><TimeFlow /></ShellPage>} />
      <Route path="/study" element={<ShellPage><Study /></ShellPage>} />
      <Route path="/habits" element={<ShellPage><Habits /></ShellPage>} />
      <Route path="/health" element={<ShellPage><Health /></ShellPage>} />
      <Route path="/journal" element={<ShellPage><Journal /></ShellPage>} />
      <Route path="/ai" element={<ShellPage><AIChat /></ShellPage>} />
      <Route path="/analytics" element={<Navigate to="/insights" replace />} />
      <Route path="/settings" element={<ShellPage><Settings /></ShellPage>} />
      <Route path="/analysis-builder" element={<ShellPage><AnalysisBuilder /></ShellPage>} />
      <Route path="/scoring" element={<ShellPage><ScoringStudio /></ShellPage>} />
      <Route path="/calendar" element={<Navigate to="/plan" replace />} />
      <Route path="/rpg" element={<Navigate to="/me" replace />} />
      <Route path="/wisdom" element={<ShellPage><Wisdom /></ShellPage>} />
      <Route path="/goals" element={<ShellPage><Goals /></ShellPage>} />
      <Route path="/decisions" element={<ShellPage><DecisionJournal /></ShellPage>} />
      <Route path="/crm" element={<ShellPage><RelationshipCRM /></ShellPage>} />
      <Route path="/brain" element={<ShellPage><SecondBrain /></ShellPage>} />
      <Route path="/readings" element={<ShellPage><ReadingTracker /></ShellPage>} />
      <Route path="/meditations" element={<ShellPage><Meditation /></ShellPage>} />
      <Route path="/wrapped" element={<ShellPage><YearInReview /></ShellPage>} />
      <Route path="/focus" element={<ShellPage><FocusMode /></ShellPage>} />
      <Route path="/shared" element={
        <Suspense fallback={<LoadingScreen />}>
          <SharedDashboard />
        </Suspense>
      } />
      <Route path="/setup" element={
        <Suspense fallback={<LoadingScreen />}>
          <SetupWizard />
        </Suspense>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
