import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import { useAuthStore } from '../../store/auth'
import { Database } from '../../lib/supabase/database.types'

// Type for the owner reference in join query
export type OwnerRef = {
  id: string;
  name: string;
  email: string | null;
}

// Extend Apartment type to include the owner
export type Apartment = Database['public']['Tables']['apartments']['Row'] & {
  owners?: OwnerRef | null
}

export type Reservation = Database['public']['Tables']['reservations']['Row'] & {
  has_communication?: boolean
}
export type Building = Database['public']['Tables']['buildings']['Row']

export interface ReservationsByDay {
  [date: string]: {
    [apartmentId: string]: Reservation
  }
}

export interface BuildingWithApartments extends Building {
  apartments: Apartment[]
}

/**
 * Fetch reservations for a specific building and date range
 */
export function useReservations(buildingId: string, year: number, month: number) {
  const { isAuthenticated } = useAuthStore()
  
  return useQuery({
    queryKey: ['reservations', buildingId, year, month],
    queryFn: async () => {
      // Check if user is authenticated
      if (!isAuthenticated) {
        throw new Error('Authentication required')
      }
      
      // First, get the building data with its apartments
      const { data: buildingData, error: buildingError } = await supabase
        .from('buildings')
        .select('id, name, description, location, active, created_at, updated_at')
        .eq('id', buildingId)
        .single()
        
      if (buildingError) {
        throw buildingError
      }
      
      if (!buildingData) {
        throw new Error('Building not found')
      }
      
      // Get apartments for this building with owner information
      const { data: apartments, error: apartmentsError } = await supabase
        .from('apartments')
        .select(`
          id, code, raw_text, owner_id, building_id, active, description, created_at, updated_at, admin_fee_percentage,
          owners:owner_id (id, name, email)
        `)
        .eq('building_id', buildingId)
        .order('raw_text', { ascending: true })
        
      if (apartmentsError) {
        throw apartmentsError
      }
      
      // Calculate start and end dates for the given month
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)
      
      const formattedStartDate = startDate.toISOString().split('T')[0]
      const formattedEndDate = endDate.toISOString().split('T')[0]
      
      // Get reservations for this building's apartments and date range
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, booking_id, apartment_id, date, rate, color_hex, comment, created_at, updated_at')
        .in('apartment_id', apartments.map(apt => apt.id))
        .gte('date', formattedStartDate)
        .lte('date', formattedEndDate)
        
      if (reservationsError) {
        throw reservationsError
      }

      // Get booking IDs with communications
      const { data: bookingsWithComms, error: bookingCommsError } = await supabase
        .from('booking_communications')
        .select('booking_id')
        .in('booking_id', reservations.map(res => res.booking_id))
        .eq('excluded', false)
        
      if (bookingCommsError) {
        throw bookingCommsError
      }
      
      // Create a set of booking IDs that have communications for quick lookup
      const bookingIdsWithComms = new Set(bookingsWithComms.map(bwc => bwc.booking_id))
      
      // Add has_communication flag to reservations
      const enhancedReservations = reservations.map(reservation => ({
        ...reservation,
        has_communication: bookingIdsWithComms.has(reservation.booking_id)
      }))
      
      // Organize reservations by date and apartment for easier rendering
      const reservationsByDay: ReservationsByDay = {}
      
      enhancedReservations.forEach(reservation => {
        if (!reservationsByDay[reservation.date]) {
          reservationsByDay[reservation.date] = {}
        }
        
        reservationsByDay[reservation.date][reservation.apartment_id] = reservation
      })
      
      // Create a strongly typed building with apartments object
      const buildingWithApartments: BuildingWithApartments = {
        ...buildingData,
        apartments
      }
      
      // Return the organized data
      return {
        building: buildingWithApartments,
        reservationsByDay,
        startDate: formattedStartDate,
        endDate: formattedEndDate
      }
    },
    enabled: isAuthenticated && !!buildingId
  })
}

