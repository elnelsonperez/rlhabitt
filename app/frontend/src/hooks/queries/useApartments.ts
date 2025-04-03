import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { Tables } from '../../lib/supabase/database.types';
import { useAuthStore } from '../../store/auth';

// Define apartment type from database
export type Apartment = Tables<'apartments'>;

// Type for apartment with related data
export interface ApartmentWithRelations extends Apartment {
  owner?: {
    id: string;
    name: string;
    email: string | null;
  };
  building?: {
    id: string;
    name: string;
  };
  bookings_count?: number;
}

// Type for filtering apartments
export interface ApartmentFilters {
  buildingId?: string;
  ownerId?: string;
  search?: string;
}

/**
 * Hook to fetch apartments with infinite pagination and filtering
 */
export function useInfiniteApartments(
  filters: ApartmentFilters = {},
  pageSize: number = 10
) {
  const { isAuthenticated } = useAuthStore();
  
  return useInfiniteQuery({
    queryKey: ['apartments', 'list', filters],
    queryFn: async ({ pageParam = 0 }) => {
      // Check if user is authenticated
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      
      let query = supabase
        .from('apartments')
        .select(`
          *,
          owner:owner_id(id, name, email),
          building:building_id(id, name)
        `)
        .order('code')
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);
      
      // Apply building filter if provided
      if (filters.buildingId) {
        query = query.eq('building_id', filters.buildingId);
      }
      
      // Apply owner filter if provided
      if (filters.ownerId) {
        query = query.eq('owner_id', filters.ownerId);
      }
      
      // Apply search filter if provided
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        
        // First, get matching owners
        const { data: matchingOwners } = await supabase
          .from('owners')
          .select('id')
          .ilike('name', searchTerm);
          
        const ownerIds = matchingOwners?.map(owner => owner.id) || [];

        query = query.or(`code.ilike.${searchTerm}${ownerIds.length > 0 ? `,owner_id.in.(${ownerIds.join(',')})`: ''}`,  );

      }
        
      const { data, error } = await query.returns<ApartmentWithRelations[]>();
      
      if (error) {
        throw error;
      }
      
      // Get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from('apartments')
        .select('*', { count: 'exact', head: true });
        
      if (countError) {
        throw countError;
      }
      
      // Add bookings count for each apartment
      const apartmentsWithBookingCount = await Promise.all(data.map(async (apartment) => {
        const { count, error: bookingCountError } = await supabase
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('apartment_id', apartment.id);
        
        if (bookingCountError) {
          console.error('Error fetching booking count:', bookingCountError);
          return { ...apartment, bookings_count: 0 };
        }
        
        return { ...apartment, bookings_count: count || 0 };
      }));
      
      return {
        data: apartmentsWithBookingCount || [],
        count: totalCount || 0,
        page: pageParam,
        pageSize
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      // If we have fewer results than the page size, there are no more pages
      if (lastPage.data.length < pageSize) {
        return undefined;
      }
      // Return the next page index
      return lastPageParam + 1;
    },
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      // Flatten the pages for easier consumption
      apartments: data.pages.flatMap(page => page.data),
      totalCount: data.pages[0]?.count || 0
    }),
    enabled: isAuthenticated
  });
}

/**
 * Hook to fetch a single apartment by ID with related data
 */
export function useApartment(id: string | null) {
  const { isAuthenticated } = useAuthStore();
  
  return useQuery({
    queryKey: ['apartments', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      
      // Check if user is authenticated
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      
      const { data, error } = await supabase
        .from('apartments')
        .select(`
          *,
          owner:owner_id(id, name, email),
          building:building_id(id, name)
        `)
        .eq('id', id)
        .single();
        
      if (error) {
        throw error;
      }
      
      return data as ApartmentWithRelations;
    },
    enabled: !!id && isAuthenticated
  });
}

/**
 * Hook to fetch bookings for an apartment
 */
export function useApartmentBookings(apartmentId: string | null) {
  const { isAuthenticated } = useAuthStore();
  
  return useQuery({
    queryKey: ['apartments', 'bookings', apartmentId],
    queryFn: async () => {
      if (!apartmentId) return [];
      
      // Check if user is authenticated
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id, check_in, check_out, total_amount, reference_code, 
          guest:guest_id(id, name)
        `)
        .eq('apartment_id', apartmentId)
        .order('check_in', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      return data;
    },
    enabled: !!apartmentId && isAuthenticated
  });
}

/**
 * Hook to update an apartment's admin fee percentage
 */
export function useUpdateApartmentFee() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      apartmentId, 
      adminFeePercentage 
    }: { 
      apartmentId: string; 
      adminFeePercentage: number 
    }) => {
      const { data, error } = await supabase
        .from('apartments')
        .update({ admin_fee_percentage: adminFeePercentage })
        .eq('id', apartmentId)
        .select();
        
      if (error) {
        throw error;
      }
      
      return data[0];
    },
    onSuccess: (data) => {
      // Invalidate all apartment queries
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      
      // Get the owner ID from the updated apartment
      const ownerId = data.owner_id;
      
      // Invalidate the owner query if we have an owner ID
      if (ownerId) {
        queryClient.invalidateQueries({ queryKey: ['owner', ownerId] });
      }
    }
  });
}