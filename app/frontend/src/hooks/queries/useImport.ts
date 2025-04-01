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
  return useQuery({
    queryKey: ['importStatus', correlationId],
    queryFn: () => correlationId ? importClient.getImportStatus(correlationId) : null,
    enabled: !!correlationId && enabled, // Only run if we have a correlationId and explicitly enabled
    refetchInterval: (query) => {
      // Auto-poll status every 2 seconds until it's completed or failed
      const data = query.state.data as ImportStatusResponse | null;
      if (!data) return false;
      return ['completed', 'failed', 'partial'].includes(data.status) ? false : 4000;
    }
  });
}