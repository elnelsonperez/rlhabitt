import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase/client';
import { Tables } from '../../lib/supabase/database.types';
import { useAuthStore } from '../../store/auth';

// Define owner type from database
export type Owner = Tables<'owners'>;

// Type for owner with apartments
export interface OwnerWithApartments extends Owner {
  apartments?: {
    id: string;
    code: string | null;
    admin_fee_percentage: number;
    building_id: string | null;
    building?: {
      id: string;
      name: string;
    };
  }[];
}

// Type for filtering owners
export interface OwnerFilters {
  buildingId?: string;
  search?: string;
}

/**
 * Hook to fetch owners with infinite pagination and filtering
 */
export function useInfiniteOwners(
  filters: OwnerFilters = {},
  pageSize: number = 10
) {
  const { isAuthenticated } = useAuthStore();
  
  return useInfiniteQuery({
    queryKey: ['owners', 'infinite', filters],
    queryFn: async ({ pageParam = 0 }) => {
      // Check if user is authenticated
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      
      let query = supabase
        .from('owners')
        .select(`
          *,
          apartments:apartments(
            id, code, admin_fee_percentage, building_id
          )
        `)
        .order('name')
        .range(pageParam * pageSize, (pageParam + 1) * pageSize - 1);
      
      // Apply building filter if provided
      if (filters.buildingId) {
        query = query.filter('apartments.building_id', 'eq', filters.buildingId);
      }
      
      // Apply search filter if provided
      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        query = query.or(`name.ilike.${searchTerm},apartments.code.ilike.${searchTerm}`);
      }
        
      const { data, error } = await query.returns<OwnerWithApartments[]>();
      
      if (error) {
        throw error;
      }
      
      // Get total count for pagination
      const { count: totalCount, error: countError } = await supabase
        .from('owners')
        .select('*', { count: 'exact', head: true });
        
      if (countError) {
        throw countError;
      }
      
      return {
        data: data || [],
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
      owners: data.pages.flatMap(page => page.data),
      totalCount: data.pages[0]?.count || 0
    }),
    enabled: isAuthenticated
  });
}

/**
 * Hook to fetch a single owner by ID
 */
export function useOwner(id: string | null) {
  const { isAuthenticated } = useAuthStore();
  
  return useQuery({
    queryKey: ['owners', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      
      // Check if user is authenticated
      if (!isAuthenticated) {
        throw new Error('Authentication required');
      }
      
      const { data, error } = await supabase
        .from('owners')
        .select(`
          *,
          apartments:apartments(
            id, code, admin_fee_percentage, building_id,
            building:buildings(id, name)
          )
        `)
        .eq('id', id)
        .single();
        
      if (error) {
        throw error;
      }
      
      return data as OwnerWithApartments;
    },
    enabled: !!id && isAuthenticated
  });
}

/**
 * Hook to update an owner
 */
export function useUpdateOwner() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (owner: Partial<Owner> & { id: string }) => {
      const { data, error } = await supabase
        .from('owners')
        .update({
          name: owner.name,
          email: owner.email,
          phone: owner.phone,
          notes: owner.notes,
          active: owner.active
        })
        .eq('id', owner.id)
        .select();
        
      if (error) {
        throw error;
      }
      
      return data[0];
    },
    onSuccess: () => {
      // Invalidate all owners queries
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      
      // Invalidate apartments queries since they include owner information
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
    }
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
      
      // Invalidate the owner queries if we have an owner ID
      if (ownerId) {
        queryClient.invalidateQueries({ queryKey: ['owners'] });
      }
    }
  });
}