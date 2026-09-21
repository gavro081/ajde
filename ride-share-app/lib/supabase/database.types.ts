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
      bookings: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          message: string | null
          passenger_id: string
          ride_id: string
          seats: number
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string | null
          passenger_id: string
          ride_id: string
          seats?: number
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          message?: string | null
          passenger_id?: string
          ride_id?: string
          seats?: number
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      car_models: {
        Row: {
          co2_emissions_g_km: number | null
          consumption_l_100km: number
          created_at: string
          engine_size_l: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: number
          make: string
          model: string
          release_year: number | null
        }
        Insert: {
          co2_emissions_g_km?: number | null
          consumption_l_100km: number
          created_at?: string
          engine_size_l: number
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id?: number
          make: string
          model: string
          release_year?: number | null
        }
        Update: {
          co2_emissions_g_km?: number | null
          consumption_l_100km?: number
          created_at?: string
          engine_size_l?: number
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: number
          make?: string
          model?: string
          release_year?: number | null
        }
        Relationships: []
      }
      cars: {
        Row: {
          car_model_id: number | null
          color: string | null
          consumption_l_100km: number
          created_at: string
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          make: string
          model: string
          owner_id: string
          plate_last3: string | null
          seats_total: number
          updated_at: string
        }
        Insert: {
          car_model_id?: number | null
          color?: string | null
          consumption_l_100km: number
          created_at?: string
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id?: string
          make: string
          model: string
          owner_id: string
          plate_last3?: string | null
          seats_total: number
          updated_at?: string
        }
        Update: {
          car_model_id?: number | null
          color?: string | null
          consumption_l_100km?: number
          created_at?: string
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          make?: string
          model?: string
          owner_id?: string
          plate_last3?: string | null
          seats_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cars_car_model_id_fkey"
            columns: ["car_model_id"]
            isOneToOne: false
            referencedRelation: "car_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cars_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          aliases: string[]
          created_at: string
          id: number
          lat: number
          lng: number
          name_en: string
          name_mk: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          id?: number
          lat: number
          lng: number
          name_en: string
          name_mk: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: number
          lat?: number
          lng?: number
          name_en?: string
          name_mk?: string
        }
        Relationships: []
      }
      imports: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          parsed_json: NonNullable<Json>
          raw_text: string
          source_hint: string | null
          spam_flags: string[]
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          parsed_json?: NonNullable<Json>
          raw_text: string
          source_hint?: string | null
          spam_flags?: string[]
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          parsed_json?: NonNullable<Json>
          raw_text?: string
          source_hint?: string | null
          spam_flags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string | null
          ride_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          ride_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          ride_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_points: {
        Row: {
          aliases: string[]
          city_id: number
          created_at: string
          id: number
          lat: number
          lng: number
          name_en: string
          name_mk: string
        }
        Insert: {
          aliases?: string[]
          city_id: number
          created_at?: string
          id?: number
          lat: number
          lng: number
          name_en: string
          name_mk: string
        }
        Update: {
          aliases?: string[]
          city_id?: number
          created_at?: string
          id?: number
          lat?: number
          lng?: number
          name_en?: string
          name_mk?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_points_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          created_at: string
          facebook: string | null
          full_name: string
          gender: Database["public"]["Enums"]["profile_gender"] | null
          id: string
          instagram: string | null
          phone: string | null
          photo_url: string
          university: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          facebook?: string | null
          full_name: string
          gender?: Database["public"]["Enums"]["profile_gender"] | null
          id: string
          instagram?: string | null
          phone?: string | null
          photo_url: string
          university: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          facebook?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["profile_gender"] | null
          id?: string
          instagram?: string | null
          phone?: string | null
          photo_url?: string
          university?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          note: string | null
          ratee_id: string
          rater_id: string
          ride_id: string
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          ratee_id: string
          rater_id: string
          ride_id: string
          score: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          ratee_id?: string
          rater_id?: string
          ride_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          body: string | null
          created_at: string
          id: string
          reason: string
          reporter_id: string
          ride_id: string | null
          target_user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          ride_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          ride_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          ride_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          ride_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          ride_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_comments_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_routing_gate: {
        Row: {
          id: boolean
          last_request_at: string
        }
        Insert: {
          id?: boolean
          last_request_at?: string
        }
        Update: {
          id?: boolean
          last_request_at?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          car_id: string | null
          claimed_by: string | null
          created_at: string
          departure_at: string
          dest_city_id: number
          dest_pickup_id: number | null
          details: NonNullable<Json>
          driver_id: string | null
          gender_preference: Database["public"]["Enums"]["ride_gender_preference"]
          id: string
          import_id: string | null
          notes: string | null
          origin_city_id: number
          origin_pickup_id: number | null
          price_per_seat_mkd: number | null
          seats_available: number
          seats_total: number
          source: Database["public"]["Enums"]["ride_source"]
          status: Database["public"]["Enums"]["ride_status"]
          tags: string[]
          updated_at: string
        }
        Insert: {
          car_id?: string | null
          claimed_by?: string | null
          created_at?: string
          departure_at: string
          dest_city_id: number
          dest_pickup_id?: number | null
          details?: NonNullable<Json>
          driver_id?: string | null
          gender_preference?: Database["public"]["Enums"]["ride_gender_preference"]
          id?: string
          import_id?: string | null
          notes?: string | null
          origin_city_id: number
          origin_pickup_id?: number | null
          price_per_seat_mkd?: number | null
          seats_available: number
          seats_total: number
          source?: Database["public"]["Enums"]["ride_source"]
          status?: Database["public"]["Enums"]["ride_status"]
          tags?: string[]
          updated_at?: string
        }
        Update: {
          car_id?: string | null
          claimed_by?: string | null
          created_at?: string
          departure_at?: string
          dest_city_id?: number
          dest_pickup_id?: number | null
          details?: NonNullable<Json>
          driver_id?: string | null
          gender_preference?: Database["public"]["Enums"]["ride_gender_preference"]
          id?: string
          import_id?: string | null
          notes?: string | null
          origin_city_id?: number
          origin_pickup_id?: number | null
          price_per_seat_mkd?: number | null
          seats_available?: number
          seats_total?: number
          source?: Database["public"]["Enums"]["ride_source"]
          status?: Database["public"]["Enums"]["ride_status"]
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rides_car_id_fkey"
            columns: ["car_id"]
            isOneToOne: false
            referencedRelation: "cars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_dest_city_id_fkey"
            columns: ["dest_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_dest_pickup_id_dest_city_id_fkey"
            columns: ["dest_pickup_id", "dest_city_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id", "city_id"]
          },
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_origin_city_id_fkey"
            columns: ["origin_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_origin_pickup_id_origin_city_id_fkey"
            columns: ["origin_pickup_id", "origin_city_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id", "city_id"]
          },
        ]
      }
      trip_shares: {
        Row: {
          booking_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          expires_at: string
          id?: string
          token?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_shares_booking_id_fkey"
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
      can_rate_ride: {
        Args: { target_profile_id: string; target_ride_id: string }
        Returns: boolean
      }
      can_read_ride_room: {
        Args: { message_time: string; target_ride_id: string }
        Returns: boolean
      }
      can_send_ride_room: { Args: { target_ride_id: string }; Returns: boolean }
      create_ride_offer: {
        Args: {
          p_offer: Json
          p_publish?: boolean
          p_submission_id: string
          p_vehicle: Json
        }
        Returns: Json
      }
      profile_rating_summary: {
        Args: { target_profile_id: string }
        Returns: {
          average: number
          count: number
        }[]
      }
      recalculate_ride_seats: {
        Args: { target_ride_id: string }
        Returns: undefined
      }
      try_ride_routing_request: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      booking_status: "requested" | "accepted" | "declined" | "cancelled"
      fuel_type: "petrol" | "diesel" | "hybrid" | "electric" | "lpg" | "other"
      profile_gender: "woman" | "man" | "non_binary" | "prefer_not_to_say"
      ride_gender_preference: "any" | "same_as_driver"
      ride_source: "native" | "imported"
      ride_status: "draft" | "published" | "full" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      booking_status: ["requested", "accepted", "declined", "cancelled"],
      fuel_type: ["petrol", "diesel", "hybrid", "electric", "lpg", "other"],
      profile_gender: ["woman", "man", "non_binary", "prefer_not_to_say"],
      ride_gender_preference: ["any", "same_as_driver"],
      ride_source: ["native", "imported"],
      ride_status: ["draft", "published", "full", "completed", "cancelled"],
    },
  },
} as const
