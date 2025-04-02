import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase/client'
import { useAuthStore } from '../../store/auth'
import { Building } from './useReservations'

/**
 * Fetch available buildings
 */
export function useBuildings() {
  const { isAuthenticated } = useAuthStore()
  
  return useQuery<Building[]>({
    queryKey: ['buildings'],
    queryFn: async () => {
      // Check if user is authenticated
      if (!isAuthenticated) {
        throw new Error('Authentication required')
      }
      
      const { data, error } = await supabase
        .from('buildings')
        .select('id, name, description, location, active, created_at, updated_at')
        .order('name', { ascending: false })
        
      if (error) {
        throw error
      }
      
      return data
    },
    enabled: isAuthenticated
  })
}