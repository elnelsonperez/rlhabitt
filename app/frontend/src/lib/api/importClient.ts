/**
 * Import API client for interacting with the sheet_parser API
 */
import { supabase } from '../supabase/client';

// Use the environment variable for the API URL
const API_BASE_URL = import.meta.env.VITE_SHEET_PARSER_API_URL || 'http://localhost:5000';

// Interface for the import response
export interface ImportResponse {
  correlation_id: string;
  status: string;
  message?: string;
  error?: string;
}

// Interface for the import status response
export interface ImportStatusResponse {
  correlation_id: string;
  status: string;
  total_sheets?: number;
  completed_sheets?: number;
  failed_sheets?: number;
  pending_sheets?: number;
  error?: string;
  message?: string;
  import_logs?: any[];
  sheet_count?: number;
}

// Import API client for making requests to the sheet_parser API
export const importClient = {
  /**
   * Trigger a new import from OneDrive
   * 
   * @param fileId - The OneDrive file ID to import
   * @param months - Number of months to import (default: 2)
   * @returns The import response with correlation_id
   */
  async triggerImport(fileId: string, months: number = 2): Promise<ImportResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ file_id: fileId, months })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to trigger import');
    }
    
    return response.json();
  },
  
  /**
   * Get the status of an import job
   * 
   * @param correlationId - The correlation ID of the import job
   * @returns The import status response
   */
  async getImportStatus(correlationId: string): Promise<ImportStatusResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('Authentication required');
    }
    
    const response = await fetch(`${API_BASE_URL}/api/import/${correlationId}/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to get import status');
    }
    
    return response.json();
  }
};