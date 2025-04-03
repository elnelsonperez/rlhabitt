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

export const commsClient = {
  /**
   * Get communications with pagination
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
    // Calculate range for pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;
    
    let query = supabase
      .from('communications')
      .select(`
        *,
        owner:owner_id (
          name,
          email
        ),
        approver:approved_by(
          email
        ),
        booking_count:booking_communications!inner(count)
      `, { count: 'exact' });
    
    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (type) {
      query = query.eq('comm_type', type);
    }
    
    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    // Apply pagination
    query = query.range(from, to);
    
    const { data, error, count } = await query;
    
    if (error) {
      throw error;
    }
    
    // Process the data to fix the booking_count object issue
    const processedData = data?.map(item => {
      console.log(item)
      return {
        ...item,
        booking_count: item.booking_count
          ? item.booking_count[0].count
          : 0
      };
    }) || [];

    console.log(processedData)
    
    return {
      data: processedData as CommunicationWithRelations[],
      count: count || 0,
      page,
      pageSize,
    };
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
  }
};