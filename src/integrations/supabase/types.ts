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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number
          payment_qr_url: string | null
          bank_name: string | null
          account_name: string | null
          account_number: string | null
          contact: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          payment_qr_url?: string | null
          bank_name?: string | null
          account_name?: string | null
          account_number?: string | null
          contact?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          payment_qr_url?: string | null
          bank_name?: string | null
          account_name?: string | null
          account_number?: string | null
          contact?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          user_id: string
          plan: string
          promo_code: string | null
          amount_kip: number
          slip_path: string
          status: string
          admin_note: string | null
          created_at: string
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          plan: string
          promo_code?: string | null
          amount_kip: number
          slip_path: string
          status?: string
          admin_note?: string | null
          created_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          plan?: string
          promo_code?: string | null
          amount_kip?: number
          slip_path?: string
          status?: string
          admin_note?: string | null
          created_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          id: string
          name: string
          price_kip: number
          duration_days: number
          quota_seconds: number
          sort_order: number
          active: boolean
        }
        Insert: {
          id: string
          name: string
          price_kip?: number
          duration_days: number
          quota_seconds: number
          sort_order?: number
          active?: boolean
        }
        Update: {
          id?: string
          name?: string
          price_kip?: number
          duration_days?: number
          quota_seconds?: number
          sort_order?: number
          active?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          trial_ends_at: string
          plan: string | null
          paid_until: string | null
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          trial_ends_at?: string
          plan?: string | null
          paid_until?: string | null
          is_admin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          trial_ends_at?: string
          plan?: string | null
          paid_until?: string | null
          is_admin?: boolean
          created_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          monthly_price_kip: number | null
          yearly_price_kip: number | null
          expires_at: string | null
          max_uses: number | null
          used_count: number
          active: boolean
          created_at: string
        }
        Insert: {
          code: string
          monthly_price_kip?: number | null
          yearly_price_kip?: number | null
          expires_at?: string | null
          max_uses?: number | null
          used_count?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          code?: string
          monthly_price_kip?: number | null
          yearly_price_kip?: number | null
          expires_at?: string | null
          max_uses?: number | null
          used_count?: number
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          id: number
          user_id: string
          seconds: number
          kind: string
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          seconds: number
          kind: string
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          seconds?: number
          kind?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_status: {
        Args: { uid: string }
        Returns: {
          status: string
          plan: string | null
          ends_at: string | null
          quota_seconds: number
          used_seconds: number
        }[]
      }
      approve_payment: {
        Args: { payment_id: string; admin_id: string }
        Returns: undefined
      }
      consume_ai_seconds: {
        Args: { uid: string; secs: number; usage_kind: string }
        Returns: number
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
