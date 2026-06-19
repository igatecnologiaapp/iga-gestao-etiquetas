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
    }
    Views: {
      product_pending_issues: {
        Row: {
          company_id: string | null
          missing_allergens: boolean | null
          missing_ingredients: boolean | null
          missing_nutrition: boolean | null
          missing_preservation: boolean | null
          missing_shelf_life: boolean | null
          name: string | null
          nutrition_in_review: boolean | null
          product_id: string | null
          status: Database["public"]["Enums"]["entity_status"] | null
          status_pending: boolean | null
        }
        Insert: {
          company_id?: string | null
          missing_allergens?: never
          missing_ingredients?: never
          missing_nutrition?: never
          missing_preservation?: never
          missing_shelf_life?: never
          name?: string | null
          nutrition_in_review?: never
          product_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          status_pending?: never
        }
        Update: {
          company_id?: string | null
          missing_allergens?: never
          missing_ingredients?: never
          missing_nutrition?: never
          missing_preservation?: never
          missing_shelf_life?: never
          name?: string | null
          nutrition_in_review?: never
          product_id?: string | null
          status?: Database["public"]["Enums"]["entity_status"] | null
          status_pending?: never
        }
        Relationships: [
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
    }
    Enums: {
      app_role: "administrador" | "supervisor" | "operador" | "consulta"
      audit_action:
        | "INSERT"
        | "UPDATE"
        | "DELETE"
        | "LOGIN"
        | "LOGOUT"
        | "PERMISSION_CHANGE"
        | "OTHER"
      entity_status: "ativo" | "inativo" | "pendente" | "revisao_necessaria"
      nutrition_status: "vigente" | "em_revisao" | "substituida" | "inativa"
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
      nutrition_status: ["vigente", "em_revisao", "substituida", "inativa"],
    },
  },
} as const
