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
      allergens: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allergens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          branch_id: string | null
          company_id: string | null
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          state: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          state?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          state?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          legal_name: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["entity_status"]
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["template_status"]
          subject: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["template_status"]
          subject: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["template_status"]
          subject?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      external_system_mappings: {
        Row: {
          company_id: string
          created_at: string
          entity_type: Database["public"]["Enums"]["external_entity_type"]
          external_id: string
          external_payload: Json | null
          id: string
          integration_config_id: string
          internal_id: string
          last_sync_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          entity_type: Database["public"]["Enums"]["external_entity_type"]
          external_id: string
          external_payload?: Json | null
          id?: string
          integration_config_id: string
          internal_id: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          entity_type?: Database["public"]["Enums"]["external_entity_type"]
          external_id?: string
          external_payload?: Json | null
          id?: string
          integration_config_id?: string
          internal_id?: string
          last_sync_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_system_mappings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_system_mappings_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          origin: string | null
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          origin?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          origin?: string | null
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_configs: {
        Row: {
          auth_type: Database["public"]["Enums"]["integration_auth_type"]
          base_url: string | null
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          last_error_at: string | null
          last_error_message: string | null
          last_success_at: string | null
          last_test_at: string | null
          name: string
          provider: string | null
          settings_json: Json
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auth_type?: Database["public"]["Enums"]["integration_auth_type"]
          base_url?: string | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          integration_type: Database["public"]["Enums"]["integration_type"]
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          last_test_at?: string | null
          name: string
          provider?: string | null
          settings_json?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auth_type?: Database["public"]["Enums"]["integration_auth_type"]
          base_url?: string | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          integration_type?: Database["public"]["Enums"]["integration_type"]
          last_error_at?: string | null
          last_error_message?: string | null
          last_success_at?: string | null
          last_test_at?: string | null
          name?: string
          provider?: string | null
          settings_json?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_configs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_event_queue: {
        Row: {
          attempts: number
          branch_id: string | null
          company_id: string
          created_at: string
          error_message: string | null
          event_name: string
          id: string
          integration_config_id: string | null
          last_attempt_at: string | null
          next_retry_at: string | null
          payload: Json
          status: Database["public"]["Enums"]["integration_queue_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          branch_id?: string | null
          company_id: string
          created_at?: string
          error_message?: string | null
          event_name: string
          id?: string
          integration_config_id?: string | null
          last_attempt_at?: string | null
          next_retry_at?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["integration_queue_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          branch_id?: string | null
          company_id?: string
          created_at?: string
          error_message?: string | null
          event_name?: string
          id?: string
          integration_config_id?: string | null
          last_attempt_at?: string | null
          next_retry_at?: string | null
          payload?: Json
          status?: Database["public"]["Enums"]["integration_queue_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_event_queue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_event_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_event_queue_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          direction: Database["public"]["Enums"]["integration_log_direction"]
          error_message: string | null
          event_type: string
          id: string
          integration_config_id: string | null
          request_payload: Json | null
          response_payload: Json | null
          status: Database["public"]["Enums"]["integration_log_status"]
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["integration_log_direction"]
          error_message?: string | null
          event_type: string
          id?: string
          integration_config_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: Database["public"]["Enums"]["integration_log_status"]
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["integration_log_direction"]
          error_message?: string | null
          event_type?: string
          id?: string
          integration_config_id?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          status?: Database["public"]["Enums"]["integration_log_status"]
        }
        Relationships: [
          {
            foreignKeyName: "integration_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_logs_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_tokens: {
        Row: {
          company_id: string
          created_at: string
          expires_at: string | null
          id: string
          integration_config_id: string
          token_hash: string
          token_name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_config_id: string
          token_hash: string
          token_name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          integration_config_id?: string
          token_hash?: string
          token_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_tokens_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhooks: {
        Row: {
          company_id: string
          created_at: string
          event: string
          id: string
          integration_config_id: string
          is_active: boolean
          last_delivery_at: string | null
          secret_hash: string | null
          target_url: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          event: string
          id?: string
          integration_config_id: string
          is_active?: boolean
          last_delivery_at?: string | null
          secret_hash?: string | null
          target_url: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          event?: string
          id?: string
          integration_config_id?: string
          is_active?: boolean
          last_delivery_at?: string | null
          secret_hash?: string | null
          target_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhooks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_webhooks_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      label_categories: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_native: boolean
          label_type: Database["public"]["Enums"]["label_type"] | null
          name: string
          status: Database["public"]["Enums"]["label_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_native?: boolean
          label_type?: Database["public"]["Enums"]["label_type"] | null
          name: string
          status?: Database["public"]["Enums"]["label_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_native?: boolean
          label_type?: Database["public"]["Enums"]["label_type"] | null
          name?: string
          status?: Database["public"]["Enums"]["label_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      label_custom_fields: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          data_type: string
          default_value: string | null
          description: string | null
          id: string
          key: string
          name: string
          status: Database["public"]["Enums"]["label_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          data_type?: string
          default_value?: string | null
          description?: string | null
          id?: string
          key: string
          name: string
          status?: Database["public"]["Enums"]["label_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          data_type?: string
          default_value?: string | null
          description?: string | null
          id?: string
          key?: string
          name?: string
          status?: Database["public"]["Enums"]["label_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_custom_fields_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      label_formats: {
        Row: {
          branch_id: string | null
          category_id: string | null
          columns: number
          company_id: string
          created_at: string
          created_by: string | null
          height: number
          id: string
          is_native: boolean
          margin_bottom: number
          margin_left: number
          margin_right: number
          margin_top: number
          name: string
          notes: string | null
          orientation: Database["public"]["Enums"]["label_orientation"]
          rows: number
          spacing_h: number
          spacing_v: number
          status: Database["public"]["Enums"]["label_status"]
          unit: Database["public"]["Enums"]["measure_unit"]
          updated_at: string
          width: number
        }
        Insert: {
          branch_id?: string | null
          category_id?: string | null
          columns?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          height: number
          id?: string
          is_native?: boolean
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          name: string
          notes?: string | null
          orientation?: Database["public"]["Enums"]["label_orientation"]
          rows?: number
          spacing_h?: number
          spacing_v?: number
          status?: Database["public"]["Enums"]["label_status"]
          unit?: Database["public"]["Enums"]["measure_unit"]
          updated_at?: string
          width: number
        }
        Update: {
          branch_id?: string | null
          category_id?: string | null
          columns?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          height?: number
          id?: string
          is_native?: boolean
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          name?: string
          notes?: string | null
          orientation?: Database["public"]["Enums"]["label_orientation"]
          rows?: number
          spacing_h?: number
          spacing_v?: number
          status?: Database["public"]["Enums"]["label_status"]
          unit?: Database["public"]["Enums"]["measure_unit"]
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "label_formats_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_formats_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "label_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_formats_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      label_layout_elements: {
        Row: {
          align: string | null
          bold: boolean
          bound_field: string | null
          color: string | null
          company_id: string
          created_at: string
          custom_field_id: string | null
          element_type: Database["public"]["Enums"]["label_element_type"]
          extra: Json | null
          fixed_text: string | null
          font_family: string | null
          font_size: number | null
          height: number
          id: string
          layer: number
          pos_x: number
          pos_y: number
          required: boolean
          updated_at: string
          version_id: string
          visible: boolean
          width: number
        }
        Insert: {
          align?: string | null
          bold?: boolean
          bound_field?: string | null
          color?: string | null
          company_id: string
          created_at?: string
          custom_field_id?: string | null
          element_type: Database["public"]["Enums"]["label_element_type"]
          extra?: Json | null
          fixed_text?: string | null
          font_family?: string | null
          font_size?: number | null
          height?: number
          id?: string
          layer?: number
          pos_x?: number
          pos_y?: number
          required?: boolean
          updated_at?: string
          version_id: string
          visible?: boolean
          width?: number
        }
        Update: {
          align?: string | null
          bold?: boolean
          bound_field?: string | null
          color?: string | null
          company_id?: string
          created_at?: string
          custom_field_id?: string | null
          element_type?: Database["public"]["Enums"]["label_element_type"]
          extra?: Json | null
          fixed_text?: string | null
          font_family?: string | null
          font_size?: number | null
          height?: number
          id?: string
          layer?: number
          pos_x?: number
          pos_y?: number
          required?: boolean
          updated_at?: string
          version_id?: string
          visible?: boolean
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "label_layout_elements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_layout_elements_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "label_layout_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      label_layout_versions: {
        Row: {
          change_reason: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          layout_id: string
          snapshot: Json | null
          updated_at: string
          version: number
        }
        Insert: {
          change_reason?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          layout_id: string
          snapshot?: Json | null
          updated_at?: string
          version: number
        }
        Update: {
          change_reason?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          layout_id?: string
          snapshot?: Json | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "label_layout_versions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_layout_versions_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "label_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      label_layouts: {
        Row: {
          branch_id: string | null
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          current_version: number
          description: string | null
          format_id: string
          id: string
          is_default: boolean
          label_type: Database["public"]["Enums"]["label_type"] | null
          locked: boolean
          name: string
          status: Database["public"]["Enums"]["label_status"]
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          format_id: string
          id?: string
          is_default?: boolean
          label_type?: Database["public"]["Enums"]["label_type"] | null
          locked?: boolean
          name: string
          status?: Database["public"]["Enums"]["label_status"]
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          format_id?: string
          id?: string
          is_default?: boolean
          label_type?: Database["public"]["Enums"]["label_type"] | null
          locked?: boolean
          name?: string
          status?: Database["public"]["Enums"]["label_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "label_layouts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_layouts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "label_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_layouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_layouts_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "label_formats"
            referencedColumns: ["id"]
          },
        ]
      }
      label_snapshots: {
        Row: {
          allergens_snapshot: Json | null
          branch_id: string | null
          company_id: string
          created_at: string
          emission_snapshot: Json | null
          id: string
          ingredients_snapshot: Json | null
          layout_snapshot: Json | null
          nutrition_snapshot: Json | null
          printed_label_id: string
          printer_snapshot: Json | null
          product_snapshot: Json | null
        }
        Insert: {
          allergens_snapshot?: Json | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          emission_snapshot?: Json | null
          id?: string
          ingredients_snapshot?: Json | null
          layout_snapshot?: Json | null
          nutrition_snapshot?: Json | null
          printed_label_id: string
          printer_snapshot?: Json | null
          product_snapshot?: Json | null
        }
        Update: {
          allergens_snapshot?: Json | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          emission_snapshot?: Json | null
          id?: string
          ingredients_snapshot?: Json | null
          layout_snapshot?: Json | null
          nutrition_snapshot?: Json | null
          printed_label_id?: string
          printer_snapshot?: Json | null
          product_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "label_snapshots_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "label_snapshots_printed_label_id_fkey"
            columns: ["printed_label_id"]
            isOneToOne: false
            referencedRelation: "printed_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_associations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          layout_id: string
          notes: string | null
          priority: number
          target_id: string | null
          target_type: Database["public"]["Enums"]["association_target"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          layout_id: string
          notes?: string | null
          priority?: number
          target_id?: string | null
          target_type: Database["public"]["Enums"]["association_target"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          layout_id?: string
          notes?: string | null
          priority?: number
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["association_target"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "layout_associations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "layout_associations_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "label_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_facts: {
        Row: {
          added_sugars_g: number | null
          carbs_g: number | null
          company_id: string
          created_at: string
          created_by: string | null
          daily_values: Json | null
          data_updated_at: string | null
          energy_kcal: number | null
          fiber_g: number | null
          id: string
          name: string
          notes: string | null
          protein_g: number | null
          reference_basis: string | null
          responsible: string | null
          saturated_fat_g: number | null
          serving_household: string | null
          serving_size_g: number | null
          servings_per_pack: number | null
          sodium_mg: number | null
          status: Database["public"]["Enums"]["nutrition_status"]
          total_fat_g: number | null
          total_sugars_g: number | null
          trans_fat_g: number | null
          updated_at: string
          version: number
        }
        Insert: {
          added_sugars_g?: number | null
          carbs_g?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          daily_values?: Json | null
          data_updated_at?: string | null
          energy_kcal?: number | null
          fiber_g?: number | null
          id?: string
          name: string
          notes?: string | null
          protein_g?: number | null
          reference_basis?: string | null
          responsible?: string | null
          saturated_fat_g?: number | null
          serving_household?: string | null
          serving_size_g?: number | null
          servings_per_pack?: number | null
          sodium_mg?: number | null
          status?: Database["public"]["Enums"]["nutrition_status"]
          total_fat_g?: number | null
          total_sugars_g?: number | null
          trans_fat_g?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          added_sugars_g?: number | null
          carbs_g?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          daily_values?: Json | null
          data_updated_at?: string | null
          energy_kcal?: number | null
          fiber_g?: number | null
          id?: string
          name?: string
          notes?: string | null
          protein_g?: number | null
          reference_basis?: string | null
          responsible?: string | null
          saturated_fat_g?: number | null
          serving_household?: string | null
          serving_size_g?: number | null
          servings_per_pack?: number | null
          sodium_mg?: number | null
          status?: Database["public"]["Enums"]["nutrition_status"]
          total_fat_g?: number | null
          total_sugars_g?: number | null
          trans_fat_g?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_facts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string
          description: string
          key: string
          module: string
        }
        Insert: {
          created_at?: string
          description: string
          key: string
          module: string
        }
        Update: {
          created_at?: string
          description?: string
          key?: string
          module?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          created_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      print_agent_pairing_codes: {
        Row: {
          code: string
          company_id: string
          consumed_at: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          label: string
          pairing_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          company_id: string
          consumed_at?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          label: string
          pairing_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          company_id?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          label?: string
          pairing_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_agent_pairing_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_agent_pairing_codes_pairing_id_fkey"
            columns: ["pairing_id"]
            isOneToOne: false
            referencedRelation: "print_agent_pairings"
            referencedColumns: ["id"]
          },
        ]
      }
      print_agent_pairings: {
        Row: {
          agent_version: string | null
          company_id: string
          created_at: string
          created_by: string | null
          device_id: string | null
          device_name: string | null
          id: string
          label: string
          last_seen_at: string | null
          last_seen_ip: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
          token_hash: string
          token_prefix: string
          updated_at: string
        }
        Insert: {
          agent_version?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          device_name?: string | null
          id?: string
          label: string
          last_seen_at?: string | null
          last_seen_ip?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_hash: string
          token_prefix: string
          updated_at?: string
        }
        Update: {
          agent_version?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          device_name?: string | null
          id?: string
          label?: string
          last_seen_at?: string | null
          last_seen_ip?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_hash?: string
          token_prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_agent_pairings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      print_batches: {
        Row: {
          batch_code: string | null
          branch_id: string | null
          company_id: string
          created_at: string
          expiration_date: string | null
          id: string
          label_layout_id: string
          label_layout_version_id: string
          label_type: Database["public"]["Enums"]["label_type"]
          layout_overridden: boolean | null
          layout_suggested: boolean | null
          layout_suggestion_source: string | null
          manufacture_date: string | null
          notes: string | null
          printer_config_id: string | null
          product_id: string
          quantity: number
          requested_by: string | null
          status: Database["public"]["Enums"]["print_batch_status"]
          updated_at: string
          variable_weight: number | null
        }
        Insert: {
          batch_code?: string | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          label_layout_id: string
          label_layout_version_id: string
          label_type: Database["public"]["Enums"]["label_type"]
          layout_overridden?: boolean | null
          layout_suggested?: boolean | null
          layout_suggestion_source?: string | null
          manufacture_date?: string | null
          notes?: string | null
          printer_config_id?: string | null
          product_id: string
          quantity: number
          requested_by?: string | null
          status?: Database["public"]["Enums"]["print_batch_status"]
          updated_at?: string
          variable_weight?: number | null
        }
        Update: {
          batch_code?: string | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          expiration_date?: string | null
          id?: string
          label_layout_id?: string
          label_layout_version_id?: string
          label_type?: Database["public"]["Enums"]["label_type"]
          layout_overridden?: boolean | null
          layout_suggested?: boolean | null
          layout_suggestion_source?: string | null
          manufacture_date?: string | null
          notes?: string | null
          printer_config_id?: string | null
          product_id?: string
          quantity?: number
          requested_by?: string | null
          status?: Database["public"]["Enums"]["print_batch_status"]
          updated_at?: string
          variable_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "print_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_batches_label_layout_id_fkey"
            columns: ["label_layout_id"]
            isOneToOne: false
            referencedRelation: "label_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_batches_label_layout_version_id_fkey"
            columns: ["label_layout_version_id"]
            isOneToOne: false
            referencedRelation: "label_layout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_batches_printer_config_id_fkey"
            columns: ["printer_config_id"]
            isOneToOne: false
            referencedRelation: "printer_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "print_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      print_events: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          event_notes: string | null
          event_type: Database["public"]["Enums"]["print_event_type"]
          id: string
          metadata: Json | null
          print_batch_id: string | null
          printed_label_id: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          event_notes?: string | null
          event_type: Database["public"]["Enums"]["print_event_type"]
          id?: string
          metadata?: Json | null
          print_batch_id?: string | null
          printed_label_id?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          event_notes?: string | null
          event_type?: Database["public"]["Enums"]["print_event_type"]
          id?: string
          metadata?: Json | null
          print_batch_id?: string | null
          printed_label_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_events_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_events_print_batch_id_fkey"
            columns: ["print_batch_id"]
            isOneToOne: false
            referencedRelation: "print_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_events_printed_label_id_fkey"
            columns: ["printed_label_id"]
            isOneToOne: false
            referencedRelation: "printed_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      print_queue: {
        Row: {
          agent_job_id: string | null
          attempts: number
          batch_id: string | null
          branch_id: string | null
          company_id: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          layout_id: string | null
          payload: Json
          printer_id: string | null
          product_id: string | null
          quantity: number
          source: Database["public"]["Enums"]["print_job_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["print_job_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_job_id?: string | null
          attempts?: number
          batch_id?: string | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          layout_id?: string | null
          payload?: Json
          printer_id?: string | null
          product_id?: string | null
          quantity?: number
          source?: Database["public"]["Enums"]["print_job_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["print_job_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_job_id?: string | null
          attempts?: number
          batch_id?: string | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          layout_id?: string | null
          payload?: Json
          printer_id?: string | null
          product_id?: string | null
          quantity?: number
          source?: Database["public"]["Enums"]["print_job_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["print_job_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_queue_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "print_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_queue_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_queue_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_queue_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "label_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_queue_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "print_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      printed_labels: {
        Row: {
          barcode_value: string | null
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          label_layout_id: string
          label_layout_version_id: string
          print_batch_id: string
          product_id: string
          qr_code_payload: Json | null
          reprint_of: string | null
          sequential_number: number
          status: Database["public"]["Enums"]["printed_label_status"]
          unique_label_code: string
        }
        Insert: {
          barcode_value?: string | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          label_layout_id: string
          label_layout_version_id: string
          print_batch_id: string
          product_id: string
          qr_code_payload?: Json | null
          reprint_of?: string | null
          sequential_number: number
          status?: Database["public"]["Enums"]["printed_label_status"]
          unique_label_code: string
        }
        Update: {
          barcode_value?: string | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          label_layout_id?: string
          label_layout_version_id?: string
          print_batch_id?: string
          product_id?: string
          qr_code_payload?: Json | null
          reprint_of?: string | null
          sequential_number?: number
          status?: Database["public"]["Enums"]["printed_label_status"]
          unique_label_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "printed_labels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_label_layout_id_fkey"
            columns: ["label_layout_id"]
            isOneToOne: false
            referencedRelation: "label_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_label_layout_version_id_fkey"
            columns: ["label_layout_version_id"]
            isOneToOne: false
            referencedRelation: "label_layout_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_print_batch_id_fkey"
            columns: ["print_batch_id"]
            isOneToOne: false
            referencedRelation: "print_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "printed_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_reprint_of_fkey"
            columns: ["reprint_of"]
            isOneToOne: false
            referencedRelation: "printed_labels"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_configs: {
        Row: {
          agent_printer_id: string | null
          auto_cut: boolean
          branch_id: string | null
          command_language:
            | Database["public"]["Enums"]["printer_command_language"]
            | null
          company_id: string
          connection_settings: Json
          connection_type: string | null
          created_at: string
          created_by: string | null
          dpi: number | null
          driver_name: string | null
          driver_notes: string | null
          id: string
          integration_config_id: string | null
          is_default: boolean
          label_advance: number | null
          location: string | null
          manufacturer: string | null
          margin_bottom: number
          margin_left: number
          margin_right: number
          margin_top: number
          max_height: number | null
          max_width: number | null
          model: string | null
          name: string
          notes: string | null
          offset_x: number
          offset_y: number
          paper_type: string | null
          printer_type: Database["public"]["Enums"]["printer_type"] | null
          protocol: string | null
          raw_language: string | null
          ribbon_type: string | null
          rotation: number
          scale: number
          speed: number | null
          status: Database["public"]["Enums"]["label_status"]
          updated_at: string
        }
        Insert: {
          agent_printer_id?: string | null
          auto_cut?: boolean
          branch_id?: string | null
          command_language?:
            | Database["public"]["Enums"]["printer_command_language"]
            | null
          company_id: string
          connection_settings?: Json
          connection_type?: string | null
          created_at?: string
          created_by?: string | null
          dpi?: number | null
          driver_name?: string | null
          driver_notes?: string | null
          id?: string
          integration_config_id?: string | null
          is_default?: boolean
          label_advance?: number | null
          location?: string | null
          manufacturer?: string | null
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          max_height?: number | null
          max_width?: number | null
          model?: string | null
          name: string
          notes?: string | null
          offset_x?: number
          offset_y?: number
          paper_type?: string | null
          printer_type?: Database["public"]["Enums"]["printer_type"] | null
          protocol?: string | null
          raw_language?: string | null
          ribbon_type?: string | null
          rotation?: number
          scale?: number
          speed?: number | null
          status?: Database["public"]["Enums"]["label_status"]
          updated_at?: string
        }
        Update: {
          agent_printer_id?: string | null
          auto_cut?: boolean
          branch_id?: string | null
          command_language?:
            | Database["public"]["Enums"]["printer_command_language"]
            | null
          company_id?: string
          connection_settings?: Json
          connection_type?: string | null
          created_at?: string
          created_by?: string | null
          dpi?: number | null
          driver_name?: string | null
          driver_notes?: string | null
          id?: string
          integration_config_id?: string | null
          is_default?: boolean
          label_advance?: number | null
          location?: string | null
          manufacturer?: string | null
          margin_bottom?: number
          margin_left?: number
          margin_right?: number
          margin_top?: number
          max_height?: number | null
          max_width?: number | null
          model?: string | null
          name?: string
          notes?: string | null
          offset_x?: number
          offset_y?: number
          paper_type?: string | null
          printer_type?: Database["public"]["Enums"]["printer_type"] | null
          protocol?: string | null
          raw_language?: string | null
          ribbon_type?: string | null
          rotation?: number
          scale?: number
          speed?: number | null
          status?: Database["public"]["Enums"]["label_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_configs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_configs_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_layout_compatibility: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          format_id: string | null
          id: string
          layout_id: string | null
          notes: string | null
          printer_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          format_id?: string | null
          id?: string
          layout_id?: string | null
          notes?: string | null
          printer_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          format_id?: string | null
          id?: string
          layout_id?: string | null
          notes?: string | null
          printer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_layout_compatibility_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_layout_compatibility_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "label_formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_layout_compatibility_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "label_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_layout_compatibility_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_allergens: {
        Row: {
          allergen_id: string
          company_id: string
          created_at: string
          id: string
          may_contain: boolean
          product_id: string
        }
        Insert: {
          allergen_id: string
          company_id: string
          created_at?: string
          id?: string
          may_contain?: boolean
          product_id: string
        }
        Update: {
          allergen_id?: string
          company_id?: string
          created_at?: string
          id?: string
          may_contain?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_allergens_allergen_id_fkey"
            columns: ["allergen_id"]
            isOneToOne: false
            referencedRelation: "allergens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_allergens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_allergens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_allergens_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          company_id: string
          created_at: string
          id: string
          ingredient_id: string
          position: number | null
          product_id: string
          quantity: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          ingredient_id: string
          position?: number | null
          product_id: string
          quantity?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          ingredient_id?: string
          position?: number | null
          product_id?: string
          quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          branch_id: string | null
          changed_at: string
          changed_by: string | null
          company_id: string
          id: string
          new_promotional_price: number | null
          new_regular_price: number | null
          new_wholesale_price: number | null
          previous_promotional_price: number | null
          previous_regular_price: number | null
          previous_wholesale_price: number | null
          product_id: string
          reason: string | null
        }
        Insert: {
          branch_id?: string | null
          changed_at?: string
          changed_by?: string | null
          company_id: string
          id?: string
          new_promotional_price?: number | null
          new_regular_price?: number | null
          new_wholesale_price?: number | null
          previous_promotional_price?: number | null
          previous_regular_price?: number | null
          previous_wholesale_price?: number | null
          product_id: string
          reason?: string | null
        }
        Update: {
          branch_id?: string | null
          changed_at?: string
          changed_by?: string | null
          company_id?: string
          id?: string
          new_promotional_price?: number | null
          new_regular_price?: number | null
          new_wholesale_price?: number | null
          previous_promotional_price?: number | null
          previous_regular_price?: number | null
          previous_wholesale_price?: number | null
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          active_promotion_id: string | null
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          current_promotional_price: number | null
          id: string
          product_id: string
          regular_price: number
          sale_unit: string | null
          status: string
          updated_at: string
          updated_by: string | null
          wholesale_min_quantity: number | null
          wholesale_price: number | null
        }
        Insert: {
          active_promotion_id?: string | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_promotional_price?: number | null
          id?: string
          product_id: string
          regular_price?: number
          sale_unit?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          wholesale_min_quantity?: number | null
          wholesale_price?: number | null
        }
        Update: {
          active_promotion_id?: string | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          current_promotional_price?: number | null
          id?: string
          product_id?: string
          regular_price?: number
          sale_unit?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          wholesale_min_quantity?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          branch_id: string | null
          brand_id: string | null
          category_id: string | null
          commercial_description: string | null
          company_id: string
          contains_gluten: boolean | null
          contains_lactose: boolean | null
          created_at: string
          created_by: string | null
          ean: string | null
          id: string
          image_url: string | null
          internal_code: string | null
          legal_notes: string | null
          name: string
          nutrition_fact_id: string | null
          preparation: string | null
          preservation: string | null
          shelf_life_days: number | null
          sku: string | null
          standard_weight: number | null
          status: Database["public"]["Enums"]["entity_status"]
          storage_temperature: string | null
          subcategory_id: string | null
          unit_of_measure: string | null
          updated_at: string
          variable_weight: boolean
        }
        Insert: {
          branch_id?: string | null
          brand_id?: string | null
          category_id?: string | null
          commercial_description?: string | null
          company_id: string
          contains_gluten?: boolean | null
          contains_lactose?: boolean | null
          created_at?: string
          created_by?: string | null
          ean?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          legal_notes?: string | null
          name: string
          nutrition_fact_id?: string | null
          preparation?: string | null
          preservation?: string | null
          shelf_life_days?: number | null
          sku?: string | null
          standard_weight?: number | null
          status?: Database["public"]["Enums"]["entity_status"]
          storage_temperature?: string | null
          subcategory_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string
          variable_weight?: boolean
        }
        Update: {
          branch_id?: string | null
          brand_id?: string | null
          category_id?: string | null
          commercial_description?: string | null
          company_id?: string
          contains_gluten?: boolean | null
          contains_lactose?: boolean | null
          created_at?: string
          created_by?: string | null
          ean?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          legal_notes?: string | null
          name?: string
          nutrition_fact_id?: string | null
          preparation?: string | null
          preservation?: string | null
          shelf_life_days?: number | null
          sku?: string | null
          standard_weight?: number | null
          status?: Database["public"]["Enums"]["entity_status"]
          storage_temperature?: string | null
          subcategory_id?: string | null
          unit_of_measure?: string | null
          updated_at?: string
          variable_weight?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_nutrition_fact_id_fkey"
            columns: ["nutrition_fact_id"]
            isOneToOne: false
            referencedRelation: "nutrition_facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_products: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          id: string
          product_id: string
          promotion_id: string
          promotion_rules: string | null
          promotional_price: number | null
          regular_price: number | null
          status: string
          updated_at: string
          wholesale_min_quantity: number | null
          wholesale_price: number | null
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          product_id: string
          promotion_id: string
          promotion_rules?: string | null
          promotional_price?: number | null
          regular_price?: number | null
          status?: string
          updated_at?: string
          wholesale_min_quantity?: number | null
          wholesale_price?: number | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          product_id?: string
          promotion_id?: string
          promotion_rules?: string | null
          promotional_price?: number | null
          regular_price?: number | null
          status?: string
          updated_at?: string
          wholesale_min_quantity?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "promotion_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "dashboard_promotions_summary"
            referencedColumns: ["promotion_id"]
          },
          {
            foreignKeyName: "promotion_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["promotion_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["promotion_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      scale_configs: {
        Row: {
          branch_id: string | null
          company_id: string
          connection_type: string | null
          created_at: string
          created_by: string | null
          id: string
          integration_config_id: string | null
          manufacturer: string | null
          model: string | null
          name: string
          protocol: string | null
          settings_json: Json
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          connection_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          integration_config_id?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          protocol?: string | null
          settings_json?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          connection_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          integration_config_id?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          protocol?: string | null
          settings_json?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scale_configs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scale_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scale_configs_integration_config_id_fkey"
            columns: ["integration_config_id"]
            isOneToOne: false
            referencedRelation: "integration_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          company_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branch_access: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_access_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_roles: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          default_branch_id: string | null
          default_company_id: string | null
          email: string | null
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["entity_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_branch_id?: string | null
          default_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_branch_id?: string | null
          default_company_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["entity_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_default_company_id_fkey"
            columns: ["default_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          message: string
          name: string
          status: Database["public"]["Enums"]["template_status"]
          updated_at: string
          variables: string[]
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          name: string
          status?: Database["public"]["Enums"]["template_status"]
          updated_at?: string
          variables?: string[]
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          name?: string
          status?: Database["public"]["Enums"]["template_status"]
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_label_summary: {
        Row: {
          branch_id: string | null
          company_id: string | null
          total_batches: number | null
          total_cancelled: number | null
          total_gondola: number | null
          total_labels: number | null
          total_nutritional: number | null
          total_reprints: number | null
        }
        Relationships: [
          {
            foreignKeyName: "printed_labels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_prints_by_period: {
        Row: {
          branch_id: string | null
          company_id: string | null
          label_type: Database["public"]["Enums"]["label_type"] | null
          period_day: string | null
          total_labels: number | null
          total_reprints: number | null
        }
        Relationships: [
          {
            foreignKeyName: "printed_labels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_prints_by_printer: {
        Row: {
          branch_id: string | null
          company_id: string | null
          printer_config_id: string | null
          printer_name: string | null
          total_labels: number | null
        }
        Relationships: [
          {
            foreignKeyName: "print_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_batches_printer_config_id_fkey"
            columns: ["printer_config_id"]
            isOneToOne: false
            referencedRelation: "printer_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_prints_by_user: {
        Row: {
          branch_id: string | null
          company_id: string | null
          email: string | null
          full_name: string | null
          total_batches: number | null
          total_labels: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_promotions_summary: {
        Row: {
          company_id: string | null
          end_date: string | null
          promotion_id: string | null
          promotion_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["promotion_status"] | null
          total_labels: number | null
          total_products: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_reprints: {
        Row: {
          branch_id: string | null
          company_id: string | null
          period_day: string | null
          total_reprints: number | null
        }
        Relationships: [
          {
            foreignKeyName: "printed_labels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_top_layouts: {
        Row: {
          branch_id: string | null
          company_id: string | null
          label_layout_id: string | null
          label_type: Database["public"]["Enums"]["label_type"] | null
          layout_name: string | null
          total_labels: number | null
        }
        Relationships: [
          {
            foreignKeyName: "printed_labels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_label_layout_id_fkey"
            columns: ["label_layout_id"]
            isOneToOne: false
            referencedRelation: "label_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_top_products: {
        Row: {
          branch_id: string | null
          company_id: string | null
          last_printed_at: string | null
          product_id: string | null
          product_name: string | null
          total_labels: number | null
        }
        Relationships: [
          {
            foreignKeyName: "printed_labels_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_pending_issues"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "printed_labels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pending_issues: {
        Row: {
          brand_id: string | null
          category_id: string | null
          company_id: string | null
          missing_allergens: boolean | null
          missing_ingredients: boolean | null
          missing_nutrition: boolean | null
          missing_preservation: boolean | null
          missing_shelf_life: boolean | null
          name: string | null
          nutrition_in_review: boolean | null
          product_id: string | null
          status: string | null
          status_pending: boolean | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          company_id?: string | null
          missing_allergens?: never
          missing_ingredients?: never
          missing_nutrition?: never
          missing_preservation?: never
          missing_shelf_life?: never
          name?: string | null
          nutrition_in_review?: never
          product_id?: string | null
          status?: never
          status_pending?: never
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          company_id?: string | null
          missing_allergens?: never
          missing_ingredients?: never
          missing_nutrition?: never
          missing_preservation?: never
          missing_shelf_life?: never
          name?: string | null
          nutrition_in_review?: never
          product_id?: string | null
          status?: never
          status_pending?: never
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_company_with_admin: {
        Args: {
          _email?: string
          _legal_name?: string
          _name: string
          _phone?: string
          _tax_id?: string
        }
        Returns: string
      }
      get_active_promotion_for_product: {
        Args: { _company_id: string; _product_id: string }
        Returns: {
          end_date: string
          name: string
          promotion_id: string
          promotion_rules: string
          promotional_price: number
          start_date: string
          wholesale_min_quantity: number
          wholesale_price: number
        }[]
      }
      has_any_role: {
        Args: {
          _company_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_global_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: Database["public"]["Enums"]["audit_action"]
          _branch_id: string
          _company_id: string
          _new: Json
          _old: Json
          _reason: string
          _record_id: string
          _table_name: string
        }
        Returns: string
      }
      suggest_label_layout: {
        Args: {
          _branch_id: string
          _company_id: string
          _label_type: Database["public"]["Enums"]["label_type"]
          _product_id: string
        }
        Returns: {
          layout_id: string
          source: string
        }[]
      }
    }
    Enums: {
      app_role: "administrador" | "supervisor" | "operador" | "consulta"
      association_target:
        | "product"
        | "category"
        | "brand"
        | "company"
        | "branch"
      audit_action:
        | "INSERT"
        | "UPDATE"
        | "DELETE"
        | "LOGIN"
        | "LOGOUT"
        | "PERMISSION_CHANGE"
        | "OTHER"
      entity_status: "ativo" | "inativo" | "pendente" | "revisao_necessaria"
      external_entity_type:
        | "product"
        | "category"
        | "brand"
        | "label"
        | "promotion"
        | "customer"
        | "supplier"
        | "price"
      integration_auth_type:
        | "none"
        | "api_key"
        | "bearer"
        | "basic"
        | "oauth2"
        | "hmac"
        | "custom"
      integration_log_direction: "inbound" | "outbound"
      integration_log_status: "success" | "error" | "pending" | "skipped"
      integration_queue_status:
        | "pending"
        | "processing"
        | "success"
        | "error"
        | "skipped"
      integration_status:
        | "inactive"
        | "testing"
        | "active"
        | "error"
        | "disabled"
      integration_type:
        | "erp"
        | "printer"
        | "scale"
        | "whatsapp"
        | "email"
        | "external_api"
        | "production"
        | "tech_sheet"
      label_element_type:
        | "product_name"
        | "internal_code"
        | "sku"
        | "barcode"
        | "qrcode"
        | "logo"
        | "brand"
        | "weight"
        | "lot"
        | "expiry"
        | "manufacture_date"
        | "ingredients"
        | "preservation"
        | "allergens"
        | "gluten"
        | "lactose"
        | "nutrition_facts"
        | "price"
        | "custom_field"
        | "fixed_text"
        | "image"
        | "line"
        | "box"
        | "observations"
      label_orientation: "vertical" | "horizontal"
      label_status: "ativo" | "inativo" | "arquivado"
      label_type:
        | "nutricional"
        | "gondola"
        | "promocional"
        | "logistica"
        | "producao"
        | "identificacao"
        | "validade"
        | "outros"
      measure_unit: "mm" | "cm" | "in" | "px"
      nutrition_status: "vigente" | "em_revisao" | "substituida" | "inativa"
      print_batch_status: "draft" | "generated" | "cancelled" | "reprinted"
      print_event_type:
        | "generated"
        | "cancelled"
        | "reprinted"
        | "layout_changed"
        | "layout_suggested"
        | "no_layout_suggestion"
        | "previewed"
        | "pdf_generated"
        | "pdf_downloaded"
      print_job_source: "print_agent" | "pdf_fallback" | "manual"
      print_job_status:
        | "pending"
        | "sent"
        | "printing"
        | "completed"
        | "failed"
        | "canceled"
      printed_label_status: "generated" | "cancelled" | "reprinted"
      printer_command_language: "ZPL" | "EPL" | "ESC_POS" | "PDF" | "generic"
      printer_type:
        | "termica"
        | "laser"
        | "inkjet"
        | "matricial"
        | "pdf"
        | "grafica_externa"
        | "bobina_continua"
        | "etiqueta_adesiva"
      promotion_status: "draft" | "scheduled" | "active" | "ended" | "cancelled"
      template_status: "draft" | "active" | "disabled"
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
      app_role: ["administrador", "supervisor", "operador", "consulta"],
      association_target: ["product", "category", "brand", "company", "branch"],
      audit_action: [
        "INSERT",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "PERMISSION_CHANGE",
        "OTHER",
      ],
      entity_status: ["ativo", "inativo", "pendente", "revisao_necessaria"],
      external_entity_type: [
        "product",
        "category",
        "brand",
        "label",
        "promotion",
        "customer",
        "supplier",
        "price",
      ],
      integration_auth_type: [
        "none",
        "api_key",
        "bearer",
        "basic",
        "oauth2",
        "hmac",
        "custom",
      ],
      integration_log_direction: ["inbound", "outbound"],
      integration_log_status: ["success", "error", "pending", "skipped"],
      integration_queue_status: [
        "pending",
        "processing",
        "success",
        "error",
        "skipped",
      ],
      integration_status: [
        "inactive",
        "testing",
        "active",
        "error",
        "disabled",
      ],
      integration_type: [
        "erp",
        "printer",
        "scale",
        "whatsapp",
        "email",
        "external_api",
        "production",
        "tech_sheet",
      ],
      label_element_type: [
        "product_name",
        "internal_code",
        "sku",
        "barcode",
        "qrcode",
        "logo",
        "brand",
        "weight",
        "lot",
        "expiry",
        "manufacture_date",
        "ingredients",
        "preservation",
        "allergens",
        "gluten",
        "lactose",
        "nutrition_facts",
        "price",
        "custom_field",
        "fixed_text",
        "image",
        "line",
        "box",
        "observations",
      ],
      label_orientation: ["vertical", "horizontal"],
      label_status: ["ativo", "inativo", "arquivado"],
      label_type: [
        "nutricional",
        "gondola",
        "promocional",
        "logistica",
        "producao",
        "identificacao",
        "validade",
        "outros",
      ],
      measure_unit: ["mm", "cm", "in", "px"],
      nutrition_status: ["vigente", "em_revisao", "substituida", "inativa"],
      print_batch_status: ["draft", "generated", "cancelled", "reprinted"],
      print_event_type: [
        "generated",
        "cancelled",
        "reprinted",
        "layout_changed",
        "layout_suggested",
        "no_layout_suggestion",
        "previewed",
        "pdf_generated",
        "pdf_downloaded",
      ],
      print_job_source: ["print_agent", "pdf_fallback", "manual"],
      print_job_status: [
        "pending",
        "sent",
        "printing",
        "completed",
        "failed",
        "canceled",
      ],
      printed_label_status: ["generated", "cancelled", "reprinted"],
      printer_command_language: ["ZPL", "EPL", "ESC_POS", "PDF", "generic"],
      printer_type: [
        "termica",
        "laser",
        "inkjet",
        "matricial",
        "pdf",
        "grafica_externa",
        "bobina_continua",
        "etiqueta_adesiva",
      ],
      promotion_status: ["draft", "scheduled", "active", "ended", "cancelled"],
      template_status: ["draft", "active", "disabled"],
    },
  },
} as const
