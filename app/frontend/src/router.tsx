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
import { CommunicationsPage } from './pages/Communications'
import { CommunicationDetailPage } from './pages/CommunicationDetail'
import { MonthlyBreakdownPage } from './pages/MonthlyBreakdown'
import { ApartmentsPage } from './pages/Apartments'
import { ApartmentDetailPage } from './pages/ApartmentDetail'
import { OwnerDetailPage } from './pages/OwnerDetail'
import { useAuthStore } from './store/auth'
import { AppLayout } from './components/Layout'
import { ApartmentFilters } from './hooks/queries/useApartments';

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

// Communications list page (protected by layout)
const communicationsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/communications',
  component: CommunicationsPage,
})

// Communication detail page (protected by layout)
const communicationDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/communications/$communicationId',
  component: CommunicationDetailPage,
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

// Monthly Breakdown page (protected by layout)
const monthlyBreakdownRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/monthly-breakdown',
  component: MonthlyBreakdownPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      ownerId: search.ownerId as string | undefined,
      buildingId: search.buildingId as string | undefined,
      year: search.year as string | undefined,
      month: search.month as string | undefined
    }
  }
})

// Apartments list page (protected by layout)
const apartmentsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/apartments',
  component: ApartmentsPage,
  validateSearch: (search: Record<string, unknown>): ApartmentFilters => {
    return {
      buildingId: search.buildingId as string | undefined,
      ownerId: search.ownerId as string | undefined,
      search: search.search as string | undefined
    }
  }
});

// Apartment detail page (protected by layout)
const apartmentDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/apartments/$apartmentId',
  component: ApartmentDetailPage,
});

// Owner detail page (protected by layout)
const ownerDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/owners/$ownerId',
  component: OwnerDetailPage,
});

// Create router with routes
const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    homeRoute,
    reservationsGridRoute,
    bookingDetailRoute,
    importRoute,
    communicationsRoute,
    communicationDetailRoute,
    monthlyBreakdownRoute,
    apartmentsRoute,
    apartmentDetailRoute,
    ownerDetailRoute,
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