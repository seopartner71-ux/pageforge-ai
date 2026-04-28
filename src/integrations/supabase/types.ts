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
      blog_topics: {
        Row: {
          blog_score: number
          competition_level: string | null
          created_at: string
          data_source: string
          id: string
          intent: string
          job_id: string
          keyword: string
          keyword_difficulty: number | null
          serp_checked: boolean
          serp_urls: Json
          strong_count: number | null
          traffic_potential: number
          word_count: number
          ws_frequency: number
        }
        Insert: {
          blog_score?: number
          competition_level?: string | null
          created_at?: string
          data_source?: string
          id?: string
          intent?: string
          job_id: string
          keyword: string
          keyword_difficulty?: number | null
          serp_checked?: boolean
          serp_urls?: Json
          strong_count?: number | null
          traffic_potential?: number
          word_count?: number
          ws_frequency?: number
        }
        Update: {
          blog_score?: number
          competition_level?: string | null
          created_at?: string
          data_source?: string
          id?: string
          intent?: string
          job_id?: string
          keyword?: string
          keyword_difficulty?: number | null
          serp_checked?: boolean
          serp_urls?: Json
          strong_count?: number | null
          traffic_potential?: number
          word_count?: number
          ws_frequency?: number
        }
        Relationships: [
          {
            foreignKeyName: "blog_topics_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "blog_topics_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_topics_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          dataforseo_cost: number
          error_message: string | null
          id: string
          input_region: string
          input_topic: string
          progress: number
          project_id: string | null
          serp_checked: number
          serp_total: number
          status: string
          topic_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dataforseo_cost?: number
          error_message?: string | null
          id?: string
          input_region?: string
          input_topic?: string
          progress?: number
          project_id?: string | null
          serp_checked?: number
          serp_total?: number
          status?: string
          topic_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dataforseo_cost?: number
          error_message?: string | null
          id?: string
          input_region?: string
          input_topic?: string
          progress?: number
          project_id?: string | null
          serp_checked?: number
          serp_total?: number
          status?: string
          topic_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      copilot_messages: {
        Row: {
          card_name: string | null
          created_at: string
          id: string
          intent: string | null
          role: string
          session_id: string
          text: string
          user_id: string
        }
        Insert: {
          card_name?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          role: string
          session_id: string
          text?: string
          user_id: string
        }
        Update: {
          card_name?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          role?: string
          session_id?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      intent_checks: {
        Row: {
          ai_markdown: string | null
          city: string
          created_at: string
          depth: number
          id: string
          name: string
          project_id: string | null
          queries: string[]
          results: Json
          search_engine: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_markdown?: string | null
          city?: string
          created_at?: string
          depth?: number
          id?: string
          name?: string
          project_id?: string | null
          queries?: string[]
          results?: Json
          search_engine?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_markdown?: string | null
          city?: string
          created_at?: string
          depth?: number
          id?: string
          name?: string
          project_id?: string | null
          queries?: string[]
          results?: Json
          search_engine?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intent_results: {
        Row: {
          check_id: string
          created_at: string
          domain: string
          engine: string
          id: string
          page_type: string | null
          position: number
          query: string
          site_type: string
          snippet: string | null
          title: string | null
          url: string
        }
        Insert: {
          check_id: string
          created_at?: string
          domain?: string
          engine?: string
          id?: string
          page_type?: string | null
          position: number
          query: string
          site_type?: string
          snippet?: string | null
          title?: string | null
          url: string
        }
        Update: {
          check_id?: string
          created_at?: string
          domain?: string
          engine?: string
          id?: string
          page_type?: string | null
          position?: number
          query?: string
          site_type?: string
          snippet?: string | null
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_results_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "intent_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          heading: string | null
          id: string
          tsv: unknown
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          heading?: string | null
          id?: string
          tsv?: unknown
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          heading?: string | null
          id?: string
          tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          author: string | null
          created_at: string
          created_by: string | null
          id: string
          source_type: string
          storage_path: string | null
          title: string
          total_chunks: number
          updated_at: string
        }
        Insert: {
          author?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          source_type?: string
          storage_path?: string | null
          title: string
          total_chunks?: number
          updated_at?: string
        }
        Update: {
          author?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          source_type?: string
          storage_path?: string | null
          title?: string
          total_chunks?: number
          updated_at?: string
        }
        Relationships: []
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
      schema_audits: {
        Row: {
          ai_recommendations: Json
          created_at: string
          domain: string
          error_message: string | null
          errors_count: number
          found_schemas_count: number
          generated_code: Json
          id: string
          issues: Json
          overall_score: number
          page_type: string
          project_id: string | null
          schemas_data: Json
          status: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          ai_recommendations?: Json
          created_at?: string
          domain?: string
          error_message?: string | null
          errors_count?: number
          found_schemas_count?: number
          generated_code?: Json
          id?: string
          issues?: Json
          overall_score?: number
          page_type?: string
          project_id?: string | null
          schemas_data?: Json
          status?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          ai_recommendations?: Json
          created_at?: string
          domain?: string
          error_message?: string | null
          errors_count?: number
          found_schemas_count?: number
          generated_code?: Json
          id?: string
          issues?: Json
          overall_score?: number
          page_type?: string
          project_id?: string | null
          schemas_data?: Json
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      semantic_clusters: {
        Row: {
          avg_score: number
          cluster_index: number
          id: string
          job_id: string
          keyword_count: number
          name: string
          type: string
        }
        Insert: {
          avg_score?: number
          cluster_index: number
          id?: string
          job_id: string
          keyword_count?: number
          name?: string
          type?: string
        }
        Update: {
          avg_score?: number
          cluster_index?: number
          id?: string
          job_id?: string
          keyword_count?: number
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "semantic_clusters_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "semantic_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      semantic_cores: {
        Row: {
          clusters: Json
          created_at: string
          id: string
          keywords: Json
          name: string
          project_id: string | null
          region: string
          search_engine: string
          seed_keywords: string[]
          topic: string
          updated_at: string
          user_id: string
          wordstat_mode: string
        }
        Insert: {
          clusters?: Json
          created_at?: string
          id?: string
          keywords?: Json
          name?: string
          project_id?: string | null
          region?: string
          search_engine?: string
          seed_keywords?: string[]
          topic?: string
          updated_at?: string
          user_id: string
          wordstat_mode?: string
        }
        Update: {
          clusters?: Json
          created_at?: string
          id?: string
          keywords?: Json
          name?: string
          project_id?: string | null
          region?: string
          search_engine?: string
          seed_keywords?: string[]
          topic?: string
          updated_at?: string
          user_id?: string
          wordstat_mode?: string
        }
        Relationships: []
      }
      semantic_jobs: {
        Row: {
          cluster_count: number
          completed_at: string | null
          created_at: string
          dataforseo_cost: number
          enabled_sources: string[]
          error_message: string | null
          id: string
          input_engine: string
          input_region: string
          input_seeds: string[]
          input_stop_words: string[]
          input_topic: string
          keyword_count: number
          progress: number
          project_id: string | null
          source_breakdown: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cluster_count?: number
          completed_at?: string | null
          created_at?: string
          dataforseo_cost?: number
          enabled_sources?: string[]
          error_message?: string | null
          id?: string
          input_engine?: string
          input_region?: string
          input_seeds?: string[]
          input_stop_words?: string[]
          input_topic?: string
          keyword_count?: number
          progress?: number
          project_id?: string | null
          source_breakdown?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cluster_count?: number
          completed_at?: string | null
          created_at?: string
          dataforseo_cost?: number
          enabled_sources?: string[]
          error_message?: string | null
          id?: string
          input_engine?: string
          input_region?: string
          input_seeds?: string[]
          input_stop_words?: string[]
          input_topic?: string
          keyword_count?: number
          progress?: number
          project_id?: string | null
          source_breakdown?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      semantic_keywords: {
        Row: {
          cluster_id: number | null
          cluster_name: string | null
          created_at: string
          data_source: string
          exact_frequency: number
          id: string
          included: boolean
          intent: string
          job_id: string
          keyword: string
          keyword_difficulty: number | null
          score: number
          serp_urls: string[]
          ws_frequency: number
        }
        Insert: {
          cluster_id?: number | null
          cluster_name?: string | null
          created_at?: string
          data_source?: string
          exact_frequency?: number
          id?: string
          included?: boolean
          intent?: string
          job_id: string
          keyword: string
          keyword_difficulty?: number | null
          score?: number
          serp_urls?: string[]
          ws_frequency?: number
        }
        Update: {
          cluster_id?: number | null
          cluster_name?: string | null
          created_at?: string
          data_source?: string
          exact_frequency?: number
          id?: string
          included?: boolean
          intent?: string
          job_id?: string
          keyword?: string
          keyword_difficulty?: number | null
          score?: number
          serp_urls?: string[]
          ws_frequency?: number
        }
        Relationships: [
          {
            foreignKeyName: "semantic_keywords_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "semantic_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      serp_snapshots: {
        Row: {
          created_at: string
          depth: number
          engine: string
          id: string
          keyword: string
          project_id: string | null
          region: string
          results: Json
          snapshot_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          depth?: number
          engine?: string
          id?: string
          keyword: string
          project_id?: string | null
          region?: string
          results?: Json
          snapshot_date?: string
          user_id: string
        }
        Update: {
          created_at?: string
          depth?: number
          engine?: string
          id?: string
          keyword?: string
          project_id?: string | null
          region?: string
          results?: Json
          snapshot_date?: string
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
      kb_search: {
        Args: { max_results?: number; q: string }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          document_title: string
          heading: string
          rank: number
        }[]
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
