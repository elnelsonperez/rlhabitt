import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { importClient, ImportResponse, ImportStatusResponse } from '../../lib/api/importClient';

/**
 * Hook for triggering a new import
 */
export function useTriggerImport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ fileId, months }: { fileId: string; months?: number }) => 
      importClient.triggerImport(fileId, months),
    
    onSuccess: (data: ImportResponse) => {
      // Invalidate and refetch import status when a new import is triggered
      queryClient.invalidateQueries({ queryKey: ['importStatus', data.correlation_id] });
    }
  });
}

/**
 * Hook for getting the status of an import job
 */
export function useImportStatus(correlationId: string | null, enabled: boolean = true) {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['importStatus', correlationId],
    queryFn: () => correlationId ? importClient.getImportStatus(correlationId) : null,
    enabled: !!correlationId && enabled, // Only run if we have a correlationId and explicitly enabled
    refetchInterval: (query) => {
      // Auto-poll status every 4 seconds until it's completed or failed
      const data = query.state.data as ImportStatusResponse | null;
      if (!data) return false;
      
      // If the import has finished (completed, failed, or partial), invalidate all queries
      // to refresh reservations data
      const isFinished = ['completed', 'failed', 'partial'].includes(data.status);
      if (isFinished) {
        // Invalidate all queries to refresh all data
        queryClient.invalidateQueries();
      }
      
      return isFinished ? false : 4000;
    }
  });
}