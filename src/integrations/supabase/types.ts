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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analyses: {
        Row: {
          ai_context: string | null
          cluster_mode: boolean | null
          cluster_results: Json | null
          competitors: string[] | null
          created_at: string
          entities: Json | null
          id: string
          is_stealth_applied: boolean | null
          page_type: string | null
          progress: Json | null
          project_id: string
          region: string
          sge_data: Json | null
          share_token: string | null
          status: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          ai_context?: string | null
          cluster_mode?: boolean | null
          cluster_results?: Json | null
          competitors?: string[] | null
          created_at?: string
          entities?: Json | null
          id?: string
          is_stealth_applied?: boolean | null
          page_type?: string | null
          progress?: Json | null
          project_id: string
          region?: string
          sge_data?: Json | null
          share_token?: string | null
          status?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          ai_context?: string | null
          cluster_mode?: boolean | null
          cluster_results?: Json | null
          competitors?: string[] | null
          created_at?: string
          entities?: Json | null
          id?: string
          is_stealth_applied?: boolean | null
          page_type?: string | null
          progress?: Json | null
          project_id?: string
          region?: string
          sge_data?: Json | null
          share_token?: string | null
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_results: {
        Row: {
          analysis_id: string
          created_at: string
          id: string
          modules: Json | null
          quick_wins: Json | null
          scores: Json | null
          tab_data: Json | null
        }
        Insert: {
          analysis_id: string
          created_at?: string
          id?: string
          modules?: Json | null
          quick_wins?: Json | null
          scores?: Json | null
          tab_data?: Json | null
        }
        Update: {
          analysis_id?: string
          created_at?: string
          id?: string
          modules?: Json | null
          quick_wins?: Json | null
          scores?: Json | null
          tab_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_analyses: {
        Row: {
          ai_markdown: string | null
          created_at: string
          file_name: string | null
          id: string
          name: string
          payload: Json
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_markdown?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          name?: string
          payload?: Json
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_markdown?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          name?: string
          payload?: Json
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      link_audits: {
        Row: {
          ai_markdown: string | null
          created_at: string
          id: string
          name: string
          payload: Json
          project_id: string
          sites: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_markdown?: string | null
          created_at?: string
          id?: string
          name?: string
          payload?: Json
          project_id: string
          sites?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_markdown?: string | null
          created_at?: string
          id?: string
          name?: string
          payload?: Json
          project_id?: string
          sites?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_audits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pdf_templates: {
        Row: {
          accent_color: string
          company_name: string | null
          created_at: string
          enabled_sections: Json
          font_family: string
          font_sizes: Json
          id: string
          is_active: boolean
          logo_url: string | null
          margins: Json
          name: string
          primary_color: string
          section_order: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          company_name?: string | null
          created_at?: string
          enabled_sections?: Json
          font_family?: string
          font_sizes?: Json
          id?: string
          is_active?: boolean
          logo_url?: string | null
          margins?: Json
          name?: string
          primary_color?: string
          section_order?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          company_name?: string | null
          created_at?: string
          enabled_sections?: Json
          font_family?: string
          font_sizes?: Json
          id?: string
          is_active?: boolean
          logo_url?: string | null
          margins?: Json
          name?: string
          primary_color?: string
          section_order?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          id: string
          is_approved: boolean
          logo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id?: string
          is_approved?: boolean
          logo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id?: string
          is_approved?: boolean
          logo_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key_name: string
          key_value: string
          updated_at: string
        }
        Insert: {
          id?: string
          key_name: string
          key_value: string
          updated_at?: string
        }
        Update: {
          id?: string
          key_name?: string
          key_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      top_analyses: {
        Row: {
          ai_markdown: string | null
          created_at: string
          file_name: string | null
          id: string
          my_domain: string | null
          name: string
          payload: Json
          project_id: string
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_markdown?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          my_domain?: string | null
          name?: string
          payload?: Json
          project_id: string
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_markdown?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          my_domain?: string | null
          name?: string
          payload?: Json
          project_id?: string
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "top_analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
