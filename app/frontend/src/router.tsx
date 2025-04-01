import { 
  Outlet, 
  createRootRoute, 
  createRoute, 
  createRouter,
  redirect
} from '@tanstack/react-router'
import { HomePage } from './pages/Home'
import { LoginPage } from './pages/Login'
import { useAuthStore } from './store/auth'
import { AppLayout } from './components/Layout'

// Create the root route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Create the protected layout route with auth check
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: AppLayout,
  beforeLoad: () => {
    // Auth check before route loads
    const { isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
})

// Home page (protected by layout)
const homeRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  component: HomePage,
})

// Login page (accessible only when logged out)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: () => {
    // Redirect to home if already authenticated
    const { isAuthenticated } = useAuthStore.getState()
    if (isAuthenticated) {
      throw redirect({ to: '/' })
    }
  },
})

// Create router with routes
const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    homeRoute,
  ]),
  loginRoute,
])

export const router = createRouter({ routeTree })

// Register the router for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}