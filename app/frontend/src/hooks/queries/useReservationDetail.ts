import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import { useAuthStore } from '../../store/auth'
import { Database } from '../../lib/supabase/database.types'

// Define types using the generated Database types
export type ReservationRow = Database['public']['Tables']['reservations']['Row']
export type BookingRow = Database['public']['Tables']['bookings']['Row']
export type ApartmentRow = Database['public']['Tables']['apartments']['Row']
export type BuildingRow = Database['public']['Tables']['buildings']['Row']
export type OwnerRow = Database['public']['Tables']['owners']['Row']
export type GuestRow = Database['public']['Tables']['guests']['Row']
export type PaymentSourceRow = Database['public']['Tables']['payment_sources']['Row']

export interface ReservationDetailData {
  reservation: ReservationRow | null
  booking: BookingRow | null
  apartment: ApartmentRow | null
  building: BuildingRow | null
  owner: OwnerRow | null
  guest: GuestRow | null
  payment_source: PaymentSourceRow | null
}

/**
 * Custom hook to fetch detailed reservation data
 */
export function useReservationDetail(reservationId: string | undefined) {
  const { isAuthenticated } = useAuthStore()
  
  return useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: async () => {
      if (!isAuthenticated) {
        throw new Error('Authentication required')
      }
      
      // Define a type for the nested join query result
      type ReservationWithRelations = ReservationRow & {
        booking: BookingRow & {
          guest: GuestRow;
          payment_source: PaymentSourceRow;
        };
        apartment: ApartmentRow & {
          building: BuildingRow;
          owner: OwnerRow;
        };
      };
      
      // Fetch reservation with all related data
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, date, rate, color_hex, comment, apartment_id, booking_id, created_at, updated_at,
          booking:booking_id(
            id, check_in, check_out, nights, total_amount, payment_status, reference_code, 
            apartment_id, guest_id, payment_source_id, created_at, updated_at,
            guest:guest_id(id, name, email, phone, notes, created_at, updated_at),
            payment_source:payment_source_id(id, name, description, active, created_at, updated_at)
          ),
          apartment:apartment_id(
            id, code, raw_text, building_id, owner_id, active, description, created_at, updated_at,
            building:building_id(id, name, description, location, active, created_at, updated_at),
            owner:owner_id(id, name, email, phone, notes, active, created_at, updated_at)
          )
        `)
        .eq('id', reservationId as string)
        .single()
        
      if (error) {
        throw error
      }
      
      // Cast the result to our typed structure
      const typedData = data as unknown as ReservationWithRelations;
      
      // Format the data into our ReservationDetailData structure
      const formattedData: ReservationDetailData = {
        reservation: typedData,
        booking: typedData.booking,
        apartment: typedData.apartment,
        building: typedData.apartment?.building,
        owner: typedData.apartment?.owner,
        guest: typedData.booking?.guest,
        payment_source: typedData.booking?.payment_source
      }
      
      return formattedData
    },
    enabled: isAuthenticated && !!reservationId
  })
}