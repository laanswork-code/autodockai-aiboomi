import { Suspense, lazy } from 'react'
import { useRoute } from './route.ts'

// Each page is its own chunk: the dashboard and problems list never load three.js.
const App = lazy(() => import('./App.tsx'))
const ProblemsPage = lazy(() => import('./pages/ProblemsPage.tsx'))
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'))

export default function Root() {
  const route = useRoute()
  return (
    <Suspense fallback={<div className="page-loading">Loading…</div>}>
      {route === '/problems' ? <ProblemsPage /> : route === '/dashboard' ? <DashboardPage /> : <App />}
    </Suspense>
  )
}
