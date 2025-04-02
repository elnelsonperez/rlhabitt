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

export interface BookingDetailData {
  booking: BookingRow | null
  apartment: ApartmentRow | null
  building: BuildingRow | null
  owner: OwnerRow | null
  guest: GuestRow | null
  payment_source: PaymentSourceRow | null
  reservations: ReservationRow[] | null
}

/**
 * Custom hook to fetch detailed booking data
 */
export function useBookingDetail(bookingId: string | undefined) {
  const { isAuthenticated } = useAuthStore()
  
  return useQuery({
    queryKey: ['booking', bookingId],
    queryFn: async () => {
      if (!isAuthenticated) {
        throw new Error('Authentication required')
      }
      
      // Define a type for the nested join query result
      type BookingWithRelations = BookingRow & {
        apartment: ApartmentRow & {
          building: BuildingRow;
          owner: OwnerRow;
        };
        guest: GuestRow;
        payment_source: PaymentSourceRow;
        reservations: ReservationRow[];
      };
      
      // Fetch booking with all related data
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, check_in, check_out, nights, total_amount, reference_code, 
          comment, apartment_id, guest_id, payment_source_id, created_at, updated_at,
          apartment:apartment_id(
            id, code, raw_text, building_id, owner_id, active, description, created_at, updated_at,
            building:building_id(id, name, description, location, active, created_at, updated_at),
            owner:owner_id(id, name, email, phone, notes, active, created_at, updated_at)
          ),
          guest:guest_id(id, name, email, phone, notes, created_at, updated_at),
          payment_source:payment_source_id(id, name, description, active, created_at, updated_at),
          reservations:id(id, date, rate, color_hex, comment, apartment_id, created_at, updated_at)
        `)
        .eq('id', bookingId as string)
        .single()
        
      if (error) {
        throw error
      }
      
      // Cast the result to our typed structure
      const typedData = data as unknown as BookingWithRelations;
      
      // Format the data into our BookingDetailData structure
      const formattedData: BookingDetailData = {
        booking: typedData,
        apartment: typedData.apartment,
        building: typedData.apartment?.building,
        owner: typedData.apartment?.owner,
        guest: typedData.guest,
        payment_source: typedData.payment_source,
        reservations: typedData.reservations
      }
      
      return formattedData
    },
    enabled: isAuthenticated && !!bookingId
  })
}