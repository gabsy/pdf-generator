export interface Database {
  public: {
    Tables: {
      sections: {
        Row: {
          id: string
          name: string
          description: string
          created_at: string
          user_id: string
          template_file_name: string | null
          template_page_count: number | null
          template_extracted_fields: any | null
          template_uploaded_at: string | null
          users_data: any | null
          field_mappings: any | null
          status: 'draft' | 'template-configured' | 'users-loaded' | 'ready'
        }
        Insert: {
          id?: string
          name: string
          description: string
          created_at?: string
          user_id: string
          template_file_name?: string | null
          template_page_count?: number | null
          template_extracted_fields?: any | null
          template_uploaded_at?: string | null
          users_data?: any | null
          field_mappings?: any | null
          status?: 'draft' | 'template-configured' | 'users-loaded' | 'ready'
        }
        Update: {
          id?: string
          name?: string
          description?: string
          created_at?: string
          user_id?: string
          template_file_name?: string | null
          template_page_count?: number | null
          template_extracted_fields?: any | null
          template_uploaded_at?: string | null
          users_data?: any | null
          field_mappings?: any | null
          status?: 'draft' | 'template-configured' | 'users-loaded' | 'ready'
        }
      }
      template_files: {
        Row: {
          id: string
          section_id: string
          file_name: string
          file_data: string
          created_at: string
        }
        Insert: {
          id?: string
          section_id: string
          file_name: string
          file_data: string
          created_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          file_name?: string
          file_data?: string
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'user'
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'user'
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'user'
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: {}
        Returns: boolean
      }
    }
    Enums: {
      user_role: 'admin' | 'user'
    }
  }
}