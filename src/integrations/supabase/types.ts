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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      api_usage: {
        Row: {
          api_calls: number
          created_at: string
          estimated_cost: number
          estimated_tokens: number
          id: string
          site_id: string | null
          user_id: string
        }
        Insert: {
          api_calls?: number
          created_at?: string
          estimated_cost?: number
          estimated_tokens?: number
          id?: string
          site_id?: string | null
          user_id: string
        }
        Update: {
          api_calls?: number
          created_at?: string
          estimated_cost?: number
          estimated_tokens?: number
          id?: string
          site_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          global_settings: Json
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          global_settings?: Json
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          global_settings?: Json
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      seo_logs: {
        Row: {
          created_at: string
          field_key: string | null
          id: string
          message: string | null
          new_value: string | null
          old_value: string | null
          post_id: number | null
          result: string
          site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          field_key?: string | null
          id?: string
          message?: string | null
          new_value?: string | null
          old_value?: string | null
          post_id?: number | null
          result?: string
          site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          field_key?: string | null
          id?: string
          message?: string | null
          new_value?: string | null
          old_value?: string | null
          post_id?: number | null
          result?: string
          site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          app_password_encrypted: string
          base_url: string
          batch_size: number
          created_at: string
          id: string
          seo_plugin: string
          site_name: string
          strict_mode: boolean
          user_id: string
          username: string
        }
        Insert: {
          app_password_encrypted: string
          base_url: string
          batch_size?: number
          created_at?: string
          id?: string
          seo_plugin: string
          site_name: string
          strict_mode?: boolean
          user_id: string
          username: string
        }
        Update: {
          app_password_encrypted?: string
          base_url?: string
          batch_size?: number
          created_at?: string
          id?: string
          seo_plugin?: string
          site_name?: string
          strict_mode?: boolean
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          conflicts: Json | null
          created_at: string
          error_code: string | null
          error_message: string | null
          existing_meta: Json | null
          id: string
          post_id: number
          post_title: string | null
          post_type: string
          post_url: string | null
          seed_keyword: string | null
          site_id: string
          status: string
          suggested_focus: string | null
          suggested_metadesc: string | null
          suggested_title: string | null
          updated_at: string
          user_id: string
          warnings: Json | null
        }
        Insert: {
          conflicts?: Json | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          existing_meta?: Json | null
          id?: string
          post_id: number
          post_title?: string | null
          post_type?: string
          post_url?: string | null
          seed_keyword?: string | null
          site_id: string
          status?: string
          suggested_focus?: string | null
          suggested_metadesc?: string | null
          suggested_title?: string | null
          updated_at?: string
          user_id: string
          warnings?: Json | null
        }
        Update: {
          conflicts?: Json | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          existing_meta?: Json | null
          id?: string
          post_id?: number
          post_title?: string | null
          post_type?: string
          post_url?: string | null
          seed_keyword?: string | null
          site_id?: string
          status?: string
          suggested_focus?: string | null
          suggested_metadesc?: string | null
          suggested_title?: string | null
          updated_at?: string
          user_id?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
