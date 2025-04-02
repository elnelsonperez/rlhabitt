import { 
  Outlet, 
  createRootRoute, 
  createRoute, 
  createRouter,
  redirect
} from '@tanstack/react-router'
import { LoginPage } from './pages/Login'
import { ReservationsGridPage } from './pages/ReservationsGrid'
import { BookingDetailPage } from './pages/BookingDetail'
import { ImportPage } from './pages/Import'
import { useAuthStore } from './store/auth'
import { AppLayout } from './components/Layout'

// Create the root route
const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Create the protected layout route
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: AppLayout,
  beforeLoad: ({ location }) => {
    // Auth check before route loads - only redirect if auth is fully initialized
    const { isAuthenticated, isLoading } = useAuthStore.getState()
    
    // Don't redirect while still loading auth state
    // This prevents the redirect loop when directly accessing a protected page
    if (!isAuthenticated && !isLoading) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href }  // Pass the attempted URL for after login
      })
    }
  },
})

// Root route - redirects to reservations
const homeRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/reservations' })
  }
})


interface ReservationsSearch {
  buildingId?: string;
  year?: string;
  month?: string;
}

// Reservations grid page (protected by layout)
const reservationsGridRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/reservations',
  component: ReservationsGridPage,
  validateSearch: (search: Record<string, unknown>): ReservationsSearch => {
    return {
      buildingId: search.buildingId as string | undefined,
      year: search.year as string | undefined,
      month: search.month as string | undefined
    }
  }
})


// Booking detail page (protected by layout)
const bookingDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/bookings/$bookingId',
  component: BookingDetailPage,
})

// Import page (protected by layout)
const importRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/import',
  component: ImportPage,
})

// Login page
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
  beforeLoad: () => {
    // Only redirect if auth is fully loaded and user is authenticated
    const { isAuthenticated, isLoading } = useAuthStore.getState()
    if (isAuthenticated && !isLoading) {
      throw redirect({ to: '/reservations' })
    }
  },
})

// Create router with routes
const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    homeRoute,
    reservationsGridRoute,
    bookingDetailRoute,
    importRoute,
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