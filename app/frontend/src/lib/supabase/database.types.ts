export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      apartments: {
        Row: {
          active: boolean | null
          building_id: string | null
          code: string | null
          created_at: string | null
          description: string | null
          id: string
          owner_id: string | null
          raw_text: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          building_id?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          raw_text: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          building_id?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          owner_id?: string | null
          raw_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "apartments_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apartments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          apartment_id: string
          check_in: string
          check_out: string | null
          created_at: string | null
          guest_id: string | null
          id: string
          nights: number | null
          payment_source_id: string | null
          payment_status: string | null
          reference_code: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          apartment_id: string
          check_in: string
          check_out?: string | null
          created_at?: string | null
          guest_id?: string | null
          id?: string
          nights?: number | null
          payment_source_id?: string | null
          payment_status?: string | null
          reference_code?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          apartment_id?: string
          check_in?: string
          check_out?: string | null
          created_at?: string | null
          guest_id?: string | null
          id?: string
          nights?: number | null
          payment_source_id?: string | null
          payment_status?: string | null
          reference_code?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_payment_source_id_fkey"
            columns: ["payment_source_id"]
            isOneToOne: false
            referencedRelation: "payment_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          location: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      color_meanings: {
        Row: {
          created_at: string | null
          id: string
          meaning: string | null
          rgb_hex: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meaning?: string | null
          rgb_hex: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meaning?: string | null
          rgb_hex?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      guests: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          correlation_id: string | null
          error_message: string | null
          file_name: string | null
          id: string
          import_date: string | null
          month: number
          status: string | null
          year: number
        }
        Insert: {
          correlation_id?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          import_date?: string | null
          month: number
          status?: string | null
          year: number
        }
        Update: {
          correlation_id?: string | null
          error_message?: string | null
          file_name?: string | null
          id?: string
          import_date?: string | null
          month?: number
          status?: string | null
          year?: number
        }
        Relationships: []
      }
      owners: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_sources: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          apartment_id: string
          booking_id: string
          color_hex: string | null
          comment: string | null
          created_at: string | null
          date: string
          id: string
          rate: number
          updated_at: string | null
        }
        Insert: {
          apartment_id: string
          booking_id: string
          color_hex?: string | null
          comment?: string | null
          created_at?: string | null
          date: string
          id?: string
          rate: number
          updated_at?: string | null
        }
        Update: {
          apartment_id?: string
          booking_id?: string
          color_hex?: string | null
          comment?: string | null
          created_at?: string | null
          date?: string
          id?: string
          rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_apartment_id_fkey"
            columns: ["apartment_id"]
            isOneToOne: false
            referencedRelation: "apartments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_booking_for_reservation: {
        Args: {
          p_apartment_id: string
          p_date: string
        }
        Returns: {
          booking_id: string
        }[]
      }
      import_json: {
        Args: {
          json_data: Json
        }
        Returns: string
      }
      import_reservation_sheet: {
        Args: {
          sheet_json: Json
          import_id: string
        }
        Returns: undefined
      }
      upsert_reservation: {
        Args: {
          p_booking_id: string
          p_apartment_id: string
          p_date: string
          p_rate: number
          p_color_hex: string
          p_comment: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
