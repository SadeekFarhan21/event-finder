export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      crew_members: {
        Row: {
          crew_code: string
          device_id: string
          joined_at: string
          name: string
          status: string
        }
        Insert: {
          crew_code: string
          device_id: string
          joined_at?: string
          name: string
          status?: string
        }
        Update: {
          crew_code?: string
          device_id?: string
          joined_at?: string
          name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_code_fkey"
            columns: ["crew_code"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["code"]
          },
        ]
      }
      crews: {
        Row: {
          address: string
          code: string
          created_at: string
          lat: number
          leave_at: string
          lng: number
          spot_id: string
          start: string | null
          title: string
          venue: string
        }
        Insert: {
          address?: string
          code: string
          created_at?: string
          lat?: number
          leave_at: string
          lng?: number
          spot_id: string
          start?: string | null
          title?: string
          venue?: string
        }
        Update: {
          address?: string
          code?: string
          created_at?: string
          lat?: number
          leave_at?: string
          lng?: number
          spot_id?: string
          start?: string | null
          title?: string
          venue?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          address: string
          category: string
          city: string
          confidence: string
          deal: string | null
          description: string
          discovered_at: string
          id: string
          image: string | null
          lat: number
          lng: number
          partner: boolean
          photo_checked_at: string | null
          price: string | null
          short: string | null
          source: string
          start: string | null
          title: string
          url: string | null
          venue: string
        }
        Insert: {
          address: string
          category: string
          city: string
          confidence: string
          deal?: string | null
          description?: string
          discovered_at?: string
          id: string
          image?: string | null
          lat: number
          lng: number
          partner?: boolean
          photo_checked_at?: string | null
          price?: string | null
          short?: string | null
          source?: string
          start?: string | null
          title: string
          url?: string | null
          venue: string
        }
        Update: {
          address?: string
          category?: string
          city?: string
          confidence?: string
          deal?: string | null
          description?: string
          discovered_at?: string
          id?: string
          image?: string | null
          lat?: number
          lng?: number
          partner?: boolean
          photo_checked_at?: string | null
          price?: string | null
          short?: string | null
          source?: string
          start?: string | null
          title?: string
          url?: string | null
          venue?: string
        }
        Relationships: []
      }
      geocache: {
        Row: {
          cached_at: string
          key: string
          lat: number | null
          lng: number | null
        }
        Insert: {
          cached_at?: string
          key: string
          lat?: number | null
          lng?: number | null
        }
        Update: {
          cached_at?: string
          key?: string
          lat?: number | null
          lng?: number | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          address: string
          area: string
          capacity: string | null
          city: string
          confidence: string
          contact: string | null
          fit: string
          found_at: string
          id: string
          kind: string
          quiet_night: string | null
          url: string | null
          venue: string
        }
        Insert: {
          address: string
          area?: string
          capacity?: string | null
          city: string
          confidence: string
          contact?: string | null
          fit?: string
          found_at?: string
          id: string
          kind?: string
          quiet_night?: string | null
          url?: string | null
          venue: string
        }
        Update: {
          address?: string
          area?: string
          capacity?: string | null
          city?: string
          confidence?: string
          contact?: string | null
          fit?: string
          found_at?: string
          id?: string
          kind?: string
          quiet_night?: string | null
          url?: string | null
          venue?: string
        }
        Relationships: []
      }
      scout_runs: {
        Row: {
          added: number | null
          city: string
          error: string | null
          focus: number | null
          id: number
          kind: string
          ms: number | null
          ran_at: string
          total: number | null
        }
        Insert: {
          added?: number | null
          city: string
          error?: string | null
          focus?: number | null
          id?: never
          kind: string
          ms?: number | null
          ran_at?: string
          total?: number | null
        }
        Update: {
          added?: number | null
          city?: string
          error?: string | null
          focus?: number | null
          id?: never
          kind?: string
          ms?: number | null
          ran_at?: string
          total?: number | null
        }
        Relationships: []
      }
      spot_activity: {
        Row: {
          city: string
          created_at: string
          device_id: string
          id: number
          kind: string
          spot_id: string
          venue: string
        }
        Insert: {
          city: string
          created_at?: string
          device_id: string
          id?: never
          kind: string
          spot_id: string
          venue: string
        }
        Update: {
          city?: string
          created_at?: string
          device_id?: string
          id?: never
          kind?: string
          spot_id?: string
          venue?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          address: string
          category: string
          city: string
          contact_email: string
          created_at: string
          deal: string | null
          description: string | null
          event_id: string | null
          id: number
          manage_token: string
          published_at: string | null
          review_note: string | null
          start: string | null
          status: string
          title: string
          updated_at: string
          url: string | null
          venue: string
        }
        Insert: {
          address: string
          category: string
          city: string
          contact_email: string
          created_at?: string
          deal?: string | null
          description?: string | null
          event_id?: string | null
          id?: never
          manage_token?: string
          published_at?: string | null
          review_note?: string | null
          start?: string | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          venue: string
        }
        Update: {
          address?: string
          category?: string
          city?: string
          contact_email?: string
          created_at?: string
          deal?: string | null
          description?: string | null
          event_id?: string | null
          id?: never
          manage_token?: string
          published_at?: string | null
          review_note?: string | null
          start?: string | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          venue?: string
        }
        Relationships: []
      }
    }
    Views: {
      upcoming_events: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          confidence: string | null
          deal: string | null
          description: string | null
          discovered_at: string | null
          id: string | null
          image: string | null
          lat: number | null
          lng: number | null
          partner: boolean | null
          photo_checked_at: string | null
          price: string | null
          short: string | null
          source: string | null
          start: string | null
          title: string | null
          url: string | null
          venue: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          confidence?: string | null
          deal?: string | null
          description?: string | null
          discovered_at?: string | null
          id?: string | null
          image?: string | null
          lat?: number | null
          lng?: number | null
          partner?: boolean | null
          photo_checked_at?: string | null
          price?: string | null
          short?: string | null
          source?: string | null
          start?: string | null
          title?: string | null
          url?: string | null
          venue?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          confidence?: string | null
          deal?: string | null
          description?: string | null
          discovered_at?: string | null
          id?: string | null
          image?: string | null
          lat?: number | null
          lng?: number | null
          partner?: boolean | null
          photo_checked_at?: string | null
          price?: string | null
          short?: string | null
          source?: string | null
          start?: string | null
          title?: string | null
          url?: string | null
          venue?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_crews: {
        Args: { p_codes: string[]; p_device_id?: string }
        Returns: {
          address: string
          code: string
          lat: number
          leave_at: string
          lng: number
          members: Json
          spot_id: string
          start: string
          title: string
          venue: string
        }[]
      }
      get_listing: {
        Args: { p_token: string }
        Returns: {
          address: string
          category: string
          city: string
          created_at: string
          deal: string
          description: string
          live: boolean
          review_note: string
          start: string
          status: string
          title: string
          updated_at: string
          url: string
          venue: string
        }[]
      }
      going_counts: {
        Args: { p_spot_ids: string[] }
        Returns: {
          going: number
          spot_id: string
        }[]
      }
      invoke_scout:
        | { Args: { city: string; task: string }; Returns: number }
        | {
            Args: { city: string; focus: number; task: string }
            Returns: number
          }
      join_crew: {
        Args: { p_code: string; p_device_id: string; p_name: string }
        Returns: undefined
      }
      listing_short: { Args: { p_token: string }; Returns: string }
      listing_stats: {
        Args: { p_token: string }
        Returns: {
          crews: number
          going: number
          people: number
          rides: number
          shares: number
          unlocks: number
          views: number
        }[]
      }
      prune_events: { Args: never; Returns: number }
      same_venue: { Args: { a: string; b: string }; Returns: boolean }
      scout_tick: { Args: never; Returns: undefined }
      set_crew_status: {
        Args: { p_code: string; p_device_id: string; p_status: string }
        Returns: undefined
      }
      start_crew: {
        Args: {
          p_address: string
          p_device_id: string
          p_lat: number
          p_leave_at: string
          p_lng: number
          p_name: string
          p_spot_id: string
          p_start: string
          p_title: string
          p_venue: string
        }
        Returns: string
      }
      submit_listing: {
        Args: {
          p_address: string
          p_category: string
          p_city: string
          p_contact_email: string
          p_deal: string
          p_description: string
          p_start: string
          p_title: string
          p_url: string
          p_venue: string
        }
        Returns: string
      }
      ungo: {
        Args: { p_device_id: string; p_spot_id: string }
        Returns: undefined
      }
      update_listing: {
        Args: {
          p_address: string
          p_category: string
          p_deal: string
          p_description: string
          p_start: string
          p_title: string
          p_token: string
          p_url: string
        }
        Returns: undefined
      }
      venue_daily: {
        Args: { p_city: string; p_days?: number; p_venue: string }
        Returns: {
          day: string
          rides: number
          unlocks: number
          views: number
        }[]
      }
      venue_movement: {
        Args: { p_city: string; p_days?: number; p_venue: string }
        Returns: {
          crews: number
          on_way: number
          people: number
        }[]
      }
      venue_spots: {
        Args: { p_city: string; p_venue: string }
        Returns: {
          category: string
          deal: string
          partner: boolean
          rides: number
          start: string
          title: string
          venue: string
          views: number
        }[]
      }
      venue_stats: {
        Args: { p_city: string; p_days?: number; p_venue: string }
        Returns: {
          kind: string
          people: number
          total: number
        }[]
      }
      venue_suggest: {
        Args: { p_city: string; p_venue: string }
        Returns: {
          venue: string
        }[]
      }
      withdraw_listing: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
