import { 
  useQuery, 
  useMutation, 
  useQueryClient, 
  useInfiniteQuery 
} from '@tanstack/react-query';
import { commsClient } from '../../lib/api/commsClient';
import { Database } from '../../lib/supabase/database.types';

/**
 * Hook for retrieving communications with infinite pagination
 */
export function useInfiniteCommunications(
  filters: {
    status?: Database['public']['Enums']['communication_status'];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  },
  pageSize: number = 10
) {
  return useInfiniteQuery({
    queryKey: ['communications', 'infinite', filters],
    queryFn: ({ pageParam = 0 }) => commsClient.getCommunications({
      ...filters,
      page: pageParam,
      pageSize
    }),
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
      communications: data.pages.flatMap(page => page.data),
      totalCount: data.pages[0]?.count || 0
    })
  });
}

/**
 * Hook for retrieving a single communication with its related bookings
 */
export function useCommunication(id: string | null) {
  return useQuery({
    queryKey: ['communication', id],
    queryFn: () => id ? commsClient.getCommunication(id) : null,
    enabled: !!id
  });
}

/**
 * Hook for approving a communication
 */
export function useApproveCommunication() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      id,
      excludedBookingIds,
      customMessage
    }: {
      id: string;
      excludedBookingIds?: string[];
      customMessage?: string;
    }) => commsClient.approveCommunication(id, { excludedBookingIds, customMessage }),
    
    onSuccess: (_, variables) => {
      // Invalidate the single communication query
      queryClient.invalidateQueries({ queryKey: ['communication', variables.id] });
      
      // Invalidate the communications list
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    }
  });
}