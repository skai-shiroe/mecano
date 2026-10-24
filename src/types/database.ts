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
      categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      comparison_runs: {
        Row: {
          algorithm_version: string
          created_at: string
          dossier_id: string
          id: string
          input_snapshot: Json
          performed_by: string | null
          result_snapshot: Json
        }
        Insert: {
          algorithm_version: string
          created_at?: string
          dossier_id: string
          id?: string
          input_snapshot: Json
          performed_by?: string | null
          result_snapshot: Json
        }
        Update: {
          algorithm_version?: string
          created_at?: string
          dossier_id?: string
          id?: string
          input_snapshot?: Json
          performed_by?: string | null
          result_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "comparison_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "quote_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comparison_runs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          created_by: string
          email: string
          expires_at: string
          id: string
          organization_id: string
          role: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by: string
          email: string
          expires_at?: string
          id?: string
          organization_id: string
          role?: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_memberships: {
        Row: {
          created_at: string
          is_active: boolean
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          accent_color: string
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          initiated_by: string
          method: string
          provider: string
          provider_payment_id: string | null
          status: string
          subscription_id: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          idempotency_key: string
          initiated_by: string
          method: string
          provider: string
          provider_payment_id?: string | null
          status?: string
          subscription_id: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          initiated_by?: string
          method?: string
          provider?: string
          provider_payment_id?: string | null
          status?: string
          subscription_id?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json
          brand: string | null
          category_id: string
          created_at: string
          fitment_verified: boolean
          id: string
          manufacturer_reference: string | null
          name: string
          search_vector: unknown
          status: string
          unit_code: string
          updated_at: string
        }
        Insert: {
          attributes?: Json
          brand?: string | null
          category_id: string
          created_at?: string
          fitment_verified?: boolean
          id?: string
          manufacturer_reference?: string | null
          name: string
          search_vector?: unknown
          status?: string
          unit_code: string
          updated_at?: string
        }
        Update: {
          attributes?: Json
          brand?: string | null
          category_id?: string
          created_at?: string
          fitment_verified?: boolean
          id?: string
          manufacturer_reference?: string | null
          name?: string
          search_vector?: unknown
          status?: string
          unit_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_code_fkey"
            columns: ["unit_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_dossier_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          details: Json
          dossier_id: string
          event_type: string
          id: string
          summary: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          dossier_id: string
          event_type: string
          id?: string
          summary: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          dossier_id?: string
          event_type?: string
          id?: string
          summary?: string
        }
        Relationships: []
      }
      quote_estimates: {
        Row: {
          created_at: string
          created_by: string | null
          dossier_id: string
          id: string
          quote_date: string | null
          quote_reference: string | null
          supplier_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dossier_id: string
          id?: string
          quote_date?: string | null
          quote_reference?: string | null
          supplier_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          id?: string
          quote_date?: string | null
          quote_reference?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_dossiers: {
        Row: {
          archived_at: string | null
          assigned_user_id: string | null
          created_at: string
          created_by: string | null
          decision_estimate_id: string | null
          decision_offer_alternative_id: string | null
          decision_note: string | null
          id: string
          organization_id: string | null
          owner_user_id: string | null
          title: string
          updated_at: string
          workflow_status: string
        }
        Insert: {
          archived_at?: string | null
          assigned_user_id?: string | null
          created_at?: string
          decision_estimate_id?: string | null
          decision_offer_alternative_id?: string | null
          decision_note?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string | null
          owner_user_id?: string | null
          title: string
          updated_at?: string
          workflow_status?: string
        }
        Update: {
          archived_at?: string | null
          assigned_user_id?: string | null
          created_at?: string
          decision_estimate_id?: string | null
          decision_offer_alternative_id?: string | null
          decision_note?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string | null
          owner_user_id?: string | null
          title?: string
          updated_at?: string
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_dossiers_decision_offer_alternative_id_fkey"
            columns: ["decision_offer_alternative_id"]
            isOneToOne: false
            referencedRelation: "quote_line_offer_alternatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_dossiers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_dossiers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_dossiers_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          condition: string | null
          created_at: string
          currency: string
          designation: string
          dossier_id: string
          id: string
          matching_note: string | null
          quality: string | null
          position: number
          quantity: number
          quote_estimate_id: string | null
          selected_product_id: string | null
          tax_basis: string
          tax_rate: number | null
          unit_code: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          condition?: string | null
          created_at?: string
          currency: string
          designation: string
          dossier_id: string
          id?: string
          matching_note?: string | null
          quality?: string | null
          position: number
          quantity: number
          quote_estimate_id?: string | null
          selected_product_id?: string | null
          tax_basis: string
          tax_rate?: number | null
          unit_code?: string | null
          unit_price: number
          updated_at?: string
        }
        Update: {
          condition?: string | null
          created_at?: string
          currency?: string
          designation?: string
          dossier_id?: string
          id?: string
          matching_note?: string | null
          quality?: string | null
          position?: number
          quantity?: number
          quote_estimate_id?: string | null
          selected_product_id?: string | null
          tax_basis?: string
          tax_rate?: number | null
          unit_code?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "quote_dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_selected_product_id_fkey"
            columns: ["selected_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_unit_code_fkey"
            columns: ["unit_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      quote_line_offer_alternatives: {
        Row: {
          added_by: string | null
          condition: string
          created_at: string
          currency: string
          delivery_days_max: number | null
          delivery_days_min: number | null
          delivery_fee: number
          delivery_zone: string
          dossier_id: string
          id: string
          offer_verified_at: string
          product_id: string | null
          product_name: string
          quality: string
          quantity: number
          quote_line_id: string
          stock_quantity: number | null
          supplier_name: string
          supplier_offer_id: string | null
          supplier_organization_id: string | null
          tax_basis: string
          unit_price: number
          valid_until: string | null
        }
        Insert: {
          added_by?: string | null
          condition: string
          created_at?: string
          currency: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          delivery_fee: number
          delivery_zone: string
          dossier_id: string
          id?: string
          offer_verified_at: string
          product_id?: string | null
          product_name: string
          quality: string
          quantity: number
          quote_line_id: string
          stock_quantity?: number | null
          supplier_name: string
          supplier_offer_id?: string | null
          supplier_organization_id?: string | null
          tax_basis: string
          unit_price: number
          valid_until?: string | null
        }
        Update: {
          added_by?: string | null
          condition?: string
          created_at?: string
          currency?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          delivery_fee?: number
          delivery_zone?: string
          dossier_id?: string
          id?: string
          offer_verified_at?: string
          product_id?: string | null
          product_name?: string
          quality?: string
          quantity?: number
          quote_line_id?: string
          stock_quantity?: number | null
          supplier_name?: string
          supplier_offer_id?: string | null
          supplier_organization_id?: string | null
          tax_basis?: string
          unit_price?: number
          valid_until?: string | null
        }
        Relationships: []
      }
      reference_entries: {
        Row: {
          category_id: string | null
          created_at: string
          currency: string
          designation: string
          external_id: string
          id: string
          kind: string
          li: number | null
          ls: number | null
          pdf_page: number
          pm: number | null
          printed_page: number | null
          raw_cells: Json
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          row_index: number
          source_family_id: string
          source_id: string
          source_item_number: string
          source_location: Json
          source_payload: Json
          table_index: number
          tax_basis: string
          unit_code: string
          unit_raw: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          currency: string
          designation: string
          external_id: string
          id?: string
          kind: string
          li?: number | null
          ls?: number | null
          pdf_page: number
          pm?: number | null
          printed_page?: number | null
          raw_cells: Json
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_index: number
          source_family_id: string
          source_id: string
          source_item_number: string
          source_location: Json
          source_payload: Json
          table_index: number
          tax_basis: string
          unit_code: string
          unit_raw: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          currency?: string
          designation?: string
          external_id?: string
          id?: string
          kind?: string
          li?: number | null
          ls?: number | null
          pdf_page?: number
          pm?: number | null
          printed_page?: number | null
          raw_cells?: Json
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_index?: number
          source_family_id?: string
          source_id?: string
          source_item_number?: string
          source_location?: Json
          source_payload?: Json
          table_index?: number
          tax_basis?: string
          unit_code?: string
          unit_raw?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_entries_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_entries_source_family_id_source_id_fkey"
            columns: ["source_family_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_families"
            referencedColumns: ["id", "source_id"]
          },
          {
            foreignKeyName: "reference_entries_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "reference_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_entries_unit_code_fkey"
            columns: ["unit_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      reference_entry_issues: {
        Row: {
          code: string
          created_at: string
          id: string
          message: string
          reference_entry_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          message: string
          reference_entry_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          message?: string
          reference_entry_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_entry_issues_reference_entry_id_fkey"
            columns: ["reference_entry_id"]
            isOneToOne: false
            referencedRelation: "reference_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_entry_issues_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_prices: {
        Row: {
          correction_note: string | null
          created_at: string
          currency: string
          id: string
          li: number
          ls: number
          matching_verified: boolean
          pm: number
          product_id: string
          published_at: string | null
          published_by: string | null
          reference_entry_id: string
          revision: number
          source_id: string
          status: string
          tax_basis: string
          unit_code: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          correction_note?: string | null
          created_at?: string
          currency: string
          id?: string
          li: number
          ls: number
          matching_verified?: boolean
          pm: number
          product_id: string
          published_at?: string | null
          published_by?: string | null
          reference_entry_id: string
          revision?: number
          source_id: string
          status?: string
          tax_basis: string
          unit_code: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          correction_note?: string | null
          created_at?: string
          currency?: string
          id?: string
          li?: number
          ls?: number
          matching_verified?: boolean
          pm?: number
          product_id?: string
          published_at?: string | null
          published_by?: string | null
          reference_entry_id?: string
          revision?: number
          source_id?: string
          status?: string
          tax_basis?: string
          unit_code?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reference_prices_product_id_unit_code_fkey"
            columns: ["product_id", "unit_code"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "unit_code"]
          },
          {
            foreignKeyName: "reference_prices_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_prices_reference_entry_id_source_id_fkey"
            columns: ["reference_entry_id", "source_id"]
            isOneToOne: false
            referencedRelation: "reference_entries"
            referencedColumns: ["id", "source_id"]
          },
          {
            foreignKeyName: "reference_prices_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "reference_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_prices_unit_code_fkey"
            columns: ["unit_code"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["code"]
          },
        ]
      }
      reference_reports: {
        Row: {
          comparison_run_id: string | null
          created_at: string
          id: string
          message: string
          reference_price_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comparison_run_id?: string | null
          created_at?: string
          id?: string
          message: string
          reference_price_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          comparison_run_id?: string | null
          created_at?: string
          id?: string
          message?: string
          reference_price_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_reports_comparison_run_id_fkey"
            columns: ["comparison_run_id"]
            isOneToOne: false
            referencedRelation: "comparison_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_reports_reference_price_id_fkey"
            columns: ["reference_price_id"]
            isOneToOne: false
            referencedRelation: "reference_prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_sources: {
        Row: {
          byte_size: number
          created_at: string
          download_origin_verified: boolean
          edition: string
          external_id: string
          id: string
          manifest: Json
          page_count: number
          provenance: string
          received_on: string
          sha256: string
          title: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          byte_size: number
          created_at?: string
          download_origin_verified?: boolean
          edition: string
          external_id: string
          id?: string
          manifest: Json
          page_count: number
          provenance: string
          received_on: string
          sha256: string
          title: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          byte_size?: number
          created_at?: string
          download_origin_verified?: boolean
          edition?: string
          external_id?: string
          id?: string
          manifest?: Json
          page_count?: number
          provenance?: string
          received_on?: string
          sha256?: string
          title?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      source_families: {
        Row: {
          category_id: string | null
          code_raw: string | null
          external_id: string
          id: string
          label: string
          label_variants: Json
          mapped_at: string | null
          mapped_by: string | null
          mapping_note: string | null
          mapping_status: string
          ordinal_raw: string
          source_group_id: string
          source_id: string
          source_pages: Json
        }
        Insert: {
          category_id?: string | null
          code_raw?: string | null
          external_id: string
          id?: string
          label: string
          label_variants?: Json
          mapped_at?: string | null
          mapped_by?: string | null
          mapping_note?: string | null
          mapping_status?: string
          ordinal_raw: string
          source_group_id: string
          source_id: string
          source_pages: Json
        }
        Update: {
          category_id?: string | null
          code_raw?: string | null
          external_id?: string
          id?: string
          label?: string
          label_variants?: Json
          mapped_at?: string | null
          mapped_by?: string | null
          mapping_note?: string | null
          mapping_status?: string
          ordinal_raw?: string
          source_group_id?: string
          source_id?: string
          source_pages?: Json
        }
        Relationships: [
          {
            foreignKeyName: "source_families_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_families_mapped_by_fkey"
            columns: ["mapped_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_families_source_group_id_source_id_fkey"
            columns: ["source_group_id", "source_id"]
            isOneToOne: false
            referencedRelation: "source_groups"
            referencedColumns: ["id", "source_id"]
          },
          {
            foreignKeyName: "source_families_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "reference_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_groups: {
        Row: {
          category_id: string | null
          chapter_label_raw: string
          declared_items: number
          external_id: string
          first_pdf_page: number
          id: string
          label_raw: string
          last_pdf_page: number
          ordinal: number
          printed_start: number | null
          source_id: string
        }
        Insert: {
          category_id?: string | null
          chapter_label_raw: string
          declared_items: number
          external_id: string
          first_pdf_page: number
          id?: string
          label_raw: string
          last_pdf_page: number
          ordinal: number
          printed_start?: number | null
          source_id: string
        }
        Update: {
          category_id?: string | null
          chapter_label_raw?: string
          declared_items?: number
          external_id?: string
          first_pdf_page?: number
          id?: string
          label_raw?: string
          last_pdf_page?: number
          ordinal?: number
          printed_start?: number | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_groups_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_groups_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "reference_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          amount: number | null
          audience: string
          billing_basis: string | null
          code: string
          created_at: string
          currency: string
          duration_days: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          audience: string
          billing_basis?: string | null
          code: string
          created_at?: string
          currency?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          audience?: string
          billing_basis?: string | null
          code?: string
          created_at?: string
          currency?: string
          duration_days?: number | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_seats: {
        Row: {
          created_at: string
          organization_id: string
          subscription_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          subscription_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_seats_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_memberships"
            referencedColumns: ["organization_id", "user_id"]
          },
          {
            foreignKeyName: "subscription_seats_subscription_id_organization_id_fkey"
            columns: ["subscription_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          activation_payment_id: string | null
          amount: number
          billing_basis: string
          created_at: string
          currency: string
          id: string
          organization_id: string | null
          period_end: string | null
          period_start: string | null
          plan_id: string
          seat_limit: number | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activation_payment_id?: string | null
          amount: number
          billing_basis: string
          created_at?: string
          currency: string
          id?: string
          organization_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id: string
          seat_limit?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activation_payment_id?: string | null
          amount?: number
          billing_basis?: string
          created_at?: string
          currency?: string
          id?: string
          organization_id?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_id?: string
          seat_limit?: number | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_activation_payment_id_fkey"
            columns: ["activation_payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          code: string
          dimension: string
          label: string
        }
        Insert: {
          code: string
          dimension: string
          label: string
        }
        Update: {
          code?: string
          dimension?: string
          label?: string
        }
        Relationships: []
      }
      supplier_applications: {
        Row: {
          applicant_user_id: string
          city: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          description: string
          id: string
          organization_id: string | null
          organization_name: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_zones: string[]
          specialties: string[]
          status: string
          updated_at: string
        }
        Insert: {
          applicant_user_id?: string
          city: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at?: string
          description: string
          id?: string
          organization_id?: string | null
          organization_name: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_zones?: string[]
          specialties?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_user_id?: string
          city?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          description?: string
          id?: string
          organization_id?: string | null
          organization_name?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_zones?: string[]
          specialties?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_offers: {
        Row: {
          availability: string
          brand: string | null
          condition: string
          created_at: string
          currency: string
          delivery_currency: string
          delivery_days_max: number | null
          delivery_days_min: number | null
          delivery_fee: number
          delivery_zone: string
          id: string
          product_id: string
          published_at: string | null
          quality: string
          status: string
          stock_quantity: number | null
          supplier_organization_id: string
          tax_basis: string
          unit_price: number
          updated_at: string
          valid_until: string | null
          verified_at: string
        }
        Insert: {
          availability?: string
          brand?: string | null
          condition?: string
          created_at?: string
          currency?: string
          delivery_currency?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          delivery_fee?: number
          delivery_zone: string
          id?: string
          product_id: string
          published_at?: string | null
          quality?: string
          status?: string
          stock_quantity?: number | null
          supplier_organization_id: string
          tax_basis: string
          unit_price: number
          updated_at?: string
          valid_until?: string | null
          verified_at?: string
        }
        Update: {
          availability?: string
          brand?: string | null
          condition?: string
          created_at?: string
          currency?: string
          delivery_currency?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          delivery_fee?: number
          delivery_zone?: string
          id?: string
          product_id?: string
          published_at?: string | null
          quality?: string
          status?: string
          stock_quantity?: number | null
          supplier_organization_id?: string
          tax_basis?: string
          unit_price?: number
          updated_at?: string
          valid_until?: string | null
          verified_at?: string
        }
        Relationships: []
      }
      supplier_offer_reviews: {
        Row: {
          created_at: string
          decision: string
          id: string
          offer_id: string
          review_note: string | null
          reviewed_by: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          offer_id: string
          review_note?: string | null
          reviewed_by: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          offer_id?: string
          review_note?: string | null
          reviewed_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_insurer_offer_alternative: {
        Args: { p_quote_line_id: string; p_supplier_offer_id: string }
        Returns: string
      }
      accept_insurer_organization_invitation: {
        Args: { p_token: string }
        Returns: string
      }
      assign_insurer_dossier: {
        Args: { p_assignee_id: string | null; p_dossier_id: string }
        Returns: undefined
      }
      compare_insurer_dossier: {
        Args: { p_dossier_id: string }
        Returns: string
      }
      record_insurer_decision: {
        Args: { p_decision_note: string | null; p_dossier_id: string; p_estimate_id: string }
        Returns: undefined
      }
      record_insurer_offer_decision: {
        Args: { p_alternative_id: string; p_decision_note: string | null; p_dossier_id: string }
        Returns: undefined
      }
      save_insurer_estimate: {
        Args: {
          p_estimate_id: string
          p_lines: Json
          p_quote_date: string | null
          p_quote_reference: string | null
          p_supplier_name: string
        }
        Returns: undefined
      }
      create_insurer_organization_invitation: {
        Args: { p_email: string; p_organization_id: string }
        Returns: { expires_at: string; invitation_id: string; token: string }[]
      }
      get_insurer_organization_invitations: {
        Args: { p_organization_id: string }
        Returns: { created_at: string; email: string; expires_at: string; id: string; role: string; status: string }[]
      }
      get_insurer_organization_members: {
        Args: { p_organization_id: string }
        Returns: { display_name: string; email: string; is_active: boolean; joined_at: string; role: string; user_id: string }[]
      }
      revoke_insurer_organization_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      set_insurer_member_active: {
        Args: { p_is_active: boolean; p_organization_id: string; p_user_id: string }
        Returns: undefined
      }
      update_insurer_organization_settings: {
        Args: { p_accent_color: string; p_city: string | null; p_contact_email: string | null; p_contact_phone: string | null; p_name: string; p_organization_id: string }
        Returns: undefined
      }
      create_insurer_organization: {
        Args: {
          p_manager_email: string
          p_name: string
        }
        Returns: string
      }
      review_supplier_application: {
        Args: {
          p_application_id: string
          p_approved: boolean
          p_note: string | null
        }
        Returns: string | null
      }
      review_supplier_offer: {
        Args: {
          p_offer_id: string
          p_approved: boolean
          p_note: string | null
        }
        Returns: undefined
      }
      submit_supplier_offer: {
        Args: {
          p_offer_id: string
        }
        Returns: undefined
      }

      set_supplier_offer_paused: {
        Args: {
          p_offer_id: string
          p_paused: boolean
        }
        Returns: undefined
      }

      can_manage_catalog_prices: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      publish_price_revision: {
        Args: {
          p_correction_note: string
          p_li: number
          p_ls: number
          p_pm: number
          p_reference_price_id: string
        }
        Returns: string
      }
      resolve_reference_entry_issue: {
        Args: {
          p_issue_id: string
          p_resolution_note: string | null
          p_status: string
        }
        Returns: string
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
