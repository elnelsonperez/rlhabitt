/**
 * Communications API client for interacting with the owner communication system
 * Includes both Supabase database operations and API calls to the sheet_parser service
 */
import { supabase } from '../supabase/client';
import { Database, Tables } from '../supabase/database.types';

// Use the environment variable for the API URL
const API_BASE_URL = import.meta.env.VITE_SHEET_PARSER_API_URL || 'http://localhost:5000';

// Base types from the database schema
type CommunicationRow = Tables<'communications'>;
type BookingCommunicationRow = Tables<'booking_communications'>;
type OwnerRow = Tables<'owners'>;
type BookingRow = Tables<'bookings'>;
type ApartmentRow = Tables<'apartments'>;
type GuestRow = Tables<'guests'>;
type PublicUserRow = Tables<'public_users'>;

// Enhanced types with joined data
export interface CommunicationWithRelations extends CommunicationRow {
  owner?: Pick<OwnerRow, 'name' | 'email'>;
  approver?: PublicUserRow;
  booking_count?: number;
  total_amount?: number; // Total sum of reservation rates
}

export interface BookingCommunicationWithRelations extends BookingCommunicationRow {
  booking?: BookingWithRelations;
}

interface BookingWithRelations extends BookingRow {
  apartment?: Pick<ApartmentRow, 'code' | 'admin_fee_percentage'>;
  guest?: Pick<GuestRow, 'name'>;
}


// Communications API client for making requests related to communications
// Type for the update custom message response
export interface UpdateMessageResponse {
  communication_id: string;
  custom_message: string;
  content: string;
  status: string;
}

// Type for booking data in monthly breakdown
export interface BookingForMonthlyBreakdown {
  id: string;
  check_in: string;
  check_out: string | null;
  nights: number | null;
  total_amount: number | null;
  apartment: {
    id: string;
    code: string | null;
    admin_fee_percentage: number;
  } | null;
  guest: {
    id: string;
    name: string | null;
  } | null;
  reservations_count: number;
  has_communication: boolean;
}

// Type for bulk status update
export interface BulkStatusUpdateResponse {
  success: boolean;
  updated: number;
  errors?: string[];
}

export const commsClient = {
  /**
   * Get communications with pagination and total amounts using the API endpoint
   */
  async getCommunications({
    status,
    type,
    page = 0,
    pageSize = 10,
    sortBy = 'created_at',
    sortOrder = 'desc'
  }: {
    status?: Database['public']['Enums']['communication_status'];
    type?: Database['public']['Enums']['communication_type'];
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    try {
      // Get user's access token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Authentication required to fetch communications');
      }
      
      // Build query parameters
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (type) params.append('type', type);
      params.append('page', (page + 1).toString()); // API uses 1-based pagination
      params.append('limit', pageSize.toString());
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);
      
      // Call the API endpoint
      const response = await fetch(`${API_BASE_URL}/api/comms/communications-with-totals?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch communications');
      }
      
      const result = await response.json();
      
      // Transform data to match our expected interface
      const processedData = (result.data || []).map((item: any) => {
        return {
          id: item.id,
          created_at: item.created_at,
          status: item.status as Database['public']['Enums']['communication_status'],
          comm_type: item.comm_type as Database['public']['Enums']['communication_type'],
          channel: item.channel as Database['public']['Enums']['communication_channel'],
          owner_id: item.owner_id,
          recipient_email: item.recipient_email,
          retry_count: item.retry_count,
          last_retry_at: item.last_retry_at,
          approved_at: item.approved_at,
          approved_by: item.approved_by,
          subject: item.subject,
          content: item.content || '',
          custom_message: item.custom_message,
          report_period_start: item.report_period_start,
          report_period_end: item.report_period_end,
          comm_metadata: item.comm_metadata || {},
          owner: {
            name: item.owner_name,
            email: item.recipient_email // Fall back to recipient email if owner email is not provided
          },
          approver: item.approver_email ? { email: item.approver_email } : undefined,
          booking_count: item.booking_count,
          total_amount: item.total_amount
        };
      });
      
      return {
        data: processedData as CommunicationWithRelations[],
        count: result.pagination.total,
        page,
        pageSize,
      };
    } catch (error) {
      console.error("Error fetching communications with totals:", error);
      throw error;
    }
  },
  
  /**
   * Get a single communication by ID with related bookings
   */
  async getCommunication(id: string) {
    // Get the communication
    const { data: communication, error: commError } = await supabase
      .from('communications')
      .select(`
        *,
        owner:owner_id (
          name,
          email
        ),
        approver:public_users!approved_by(
          email
        )
      `)
      .eq('id', id)
      .single();
    
    if (commError) {
      throw commError;
    }

    // Get the bookings associated with this communication
    const { data: bookingCommunications, error: bookingsError } = await supabase
      .from('booking_communications')
      .select(`
        communication_id,
        booking_id,
        excluded,
        booking:booking_id (
          check_in,
          check_out,
          total_amount,
          nights,
          apartment:apartment_id (
            code,
            admin_fee_percentage
          ),
          guest:guest_id (
            name
          )
        )
      `)
      .eq('communication_id', id);
    
    if (bookingsError) {
      throw bookingsError;
    }
    
    return {
      communication: communication as CommunicationWithRelations,
      bookings: bookingCommunications as BookingCommunicationWithRelations[],
    };
  },
  
  /**
   * Approve a communication
   */
  async approveCommunication(id: string, options: {
    excludedBookingIds?: string[];
    customMessage?: string;
  }) {
    const { excludedBookingIds = [], customMessage } = options;
    
    try {
      // Update excluded status for bookings if provided
      if (excludedBookingIds.length > 0) {
        const { error: excludeError } = await supabase
          .from('booking_communications')
          .update({ excluded: true })
          .eq('communication_id', id)
          .in('booking_id', excludedBookingIds);
          
        if (excludeError) throw excludeError;
      }
      
      // Update the communication status to approved
      const updateData: Partial<CommunicationRow> = {
        status: 'approved',
        approved_at: new Date().toISOString(),
      };
      
      // Get current user ID for approved_by field
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        updateData.approved_by = user.id;
      }
      
      // Add custom message if provided
      if (customMessage) {
        updateData.custom_message = customMessage;
      }
      
      // Update the communication
      const { error: updateError } = await supabase
        .from('communications')
        .update(updateData)
        .eq('id', id);
        
      if (updateError) throw updateError;
      
      return { success: true };
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * Update custom message and regenerate email content
   */
  async updateCustomMessage(id: string, customMessage: string): Promise<UpdateMessageResponse> {
    // Get user's access token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('Authentication required to update communications');
    }
    
    // Call the API endpoint
    const response = await fetch(`${API_BASE_URL}/api/comms/update-message/${id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        custom_message: customMessage
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update custom message');
    }
    
    return await response.json();
  },
  
  /**
   * Get all reservations for a specific booking to calculate accurate rates
   */
  async getBookingReservations(bookingId: string) {
    const { data, error } = await supabase
      .from('reservations')
      .select('id, date, rate')
      .eq('booking_id', bookingId)
      .order('date');
      
    if (error) {
      throw error;
    }
    
    return data;
  },

  /**
   * Get all bookings for a specific owner in a given month
   */
  async getOwnerMonthlyBookings(ownerId: string, year: number, month: number) {
    // Format date range for the selected month
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    // Query bookings for apartments owned by this owner
    const { data: apartments, error: apartmentsError } = await supabase
      .from('apartments')
      .select('id')
      .eq('owner_id', ownerId);
      
    if (apartmentsError) {
      throw apartmentsError;
    }
    
    const apartmentIds = apartments.map(apt => apt.id);
    
    if (apartmentIds.length === 0) {
      return { owner: null, bookings: [] };
    }
    
    // Get owner details
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .select('id, name, email')
      .eq('id', ownerId)
      .single();
      
    if (ownerError) {
      throw ownerError;
    }
    
    // Get bookings for these apartments
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, 
        check_in, 
        check_out,
        nights, 
        total_amount,
        apartment:apartment_id (
          id,
          code,
          admin_fee_percentage
        ),
        guest:guest_id (
          id,
          name
        )
      `)
      .in('apartment_id', apartmentIds)
      .gte('check_in', startDate)
      .lte('check_in', endDate);
      
    if (bookingsError) {
      throw bookingsError;
    }
    
    // For each booking, get reservation count and check if it has been communicated
    const bookingsWithDetails = await Promise.all(bookings.map(async (booking) => {
      // Count reservations
      const { count: reservationsCount } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('booking_id', booking.id);
        
      // Check if booking has communications
      const { count: commCount } = await supabase
        .from('booking_communications')
        .select('communication_id', { count: 'exact', head: true })
        .eq('booking_id', booking.id);
        
      return {
        ...booking,
        reservations_count: reservationsCount || 0,
        has_communication: (commCount || 0) > 0
      };
    }));
    
    return {
      owner,
      bookings: bookingsWithDetails as BookingForMonthlyBreakdown[]
    };
  },

  /**
   * Reset a failed communication for retry
   */
  async retryCommunication(id: string): Promise<{ success: boolean }> {
    try {
      const { error } = await supabase
        .from('communications')
        .update({ 
          status: 'pending',
          retry_count: 0,  // Reset retry count
          last_retry_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) {
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error retrying communication:', error);
      throw error;
    }
  },
  
  /**
   * Update status for multiple communications
   */
  async updateCommunicationsStatus(
    communicationIds: string[],
    newStatus: Database['public']['Enums']['communication_status']
  ): Promise<BulkStatusUpdateResponse> {
    if (!communicationIds.length) {
      return { success: true, updated: 0 };
    }

    try {
      const { data, error } = await supabase
        .from('communications')
        .update({ status: newStatus })
        .in('id', communicationIds)
        .select('id');

      if (error) {
        throw error;
      }

      return {
        success: true,
        updated: data?.length || 0
      };
    } catch (error) {
      console.error('Error updating communications status:', error);
      return {
        success: false,
        updated: 0,
        errors: [(error as Error).message]
      };
    }
  },

  /**
   * Create a monthly breakdown communication for an owner using the backend API
   */
  async createMonthlyBreakdown({
    ownerId,
    bookingIds,
    customMessage,
    reportPeriod
  }: {
    ownerId: string;
    bookingIds: string[];
    customMessage?: string;
    reportPeriod: { start: string; end: string };
  }) {
    // Get user's access token from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      throw new Error('Authentication required to create communications');
    }
    
    // Call the API endpoint
    const response = await fetch(`${API_BASE_URL}/api/comms/monthly-breakdown`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        owner_id: ownerId,
        booking_ids: bookingIds,
        custom_message: customMessage,
        report_period: reportPeriod
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create monthly breakdown');
    }
    
    const result = await response.json();
    
    return {
      communicationId: result.communication_id
    };
  }
};