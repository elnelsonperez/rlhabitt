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

  // TODO move this to backend
  /**
   * Create a monthly breakdown communication for an owner
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
    // All of this needs to be moved to the API

    // Get owner details
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .select('id, name, email')
      .eq('id', ownerId)
      .single();
      
    if (ownerError) {
      throw ownerError;
    }
    
    // Create the communication record
    // First get the proper column names from Supabase
    const { data: communication, error: commError } = await supabase
      .from('communications')
      .insert({
        // Supabase uses snake_case for column names
        owner_id: ownerId,
        recipient_email: owner.email || '',
        comm_type: 'new_booking',
        status: 'pending',
        subject: `Resumen mensual: ${new Date(reportPeriod.start).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
        custom_message: customMessage || null,
        report_period_start: reportPeriod.start,
        report_period_end: reportPeriod.end,
      })
      .select()
      .single();
      
    if (commError) {
      throw commError;
    }
    
    // Create booking_communications entries
    const bookingCommunications = bookingIds.map(bookingId => ({
      communication_id: communication.id,
      booking_id: bookingId,
      excluded: false
    }));
    
    const { error: bcError } = await supabase
      .from('booking_communications')
      .insert(bookingCommunications);
      
    if (bcError) {
      throw bcError;
    }
    
    // Generate email content using the existing updateCustomMessage method
    await this.updateCustomMessage(communication.id, customMessage || '');
    
    return {
      communicationId: communication.id
    };
  }
};