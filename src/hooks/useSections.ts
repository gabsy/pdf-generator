import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Section, PDFTemplate, User, FieldMapping } from '../types'
import { Database } from '../types/database'

type SectionRow = Database['public']['Tables']['sections']['Row']
type SectionInsert = Database['public']['Tables']['sections']['Insert']
type SectionUpdate = Database['public']['Tables']['sections']['Update']

// Convert database row to Section type
function dbRowToSection(row: SectionRow): Section {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: new Date(row.created_at),
    status: row.status,
    users: row.users_data ? JSON.parse(row.users_data) : [],
    fieldMappings: row.field_mappings ? JSON.parse(row.field_mappings) : [],
    template: row.template_file_name ? {
      fileName: row.template_file_name,
      fileData: new ArrayBuffer(0), // Will be loaded separately when needed
      extractedFields: row.template_extracted_fields ? JSON.parse(row.template_extracted_fields) : [],
      uploadedAt: new Date(row.template_uploaded_at!),
      pageCount: row.template_page_count!
    } : undefined
  }
}

export function useSections() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const sectionsQuery = useQuery({
    queryKey: ['sections', user?.id],
    queryFn: async () => {
      if (!user) return []
      
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data.map(dbRowToSection)
    },
    enabled: !!user,
  })

  const createSectionMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      if (!user) throw new Error('User not authenticated')

      const sectionData: SectionInsert = {
        name,
        description,
        user_id: user.id,
        status: 'draft'
      }

      const { data, error } = await supabase
        .from('sections')
        .insert(sectionData)
        .select()
        .single()

      if (error) throw error
      return dbRowToSection(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', user?.id] })
    },
  })

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Section> }) => {
      const updateData: SectionUpdate = {}
      
      if (updates.name) updateData.name = updates.name
      if (updates.description) updateData.description = updates.description
      if (updates.status) updateData.status = updates.status
      if (updates.users) updateData.users_data = JSON.stringify(updates.users)
      if (updates.fieldMappings) updateData.field_mappings = JSON.stringify(updates.fieldMappings)
      
      if (updates.template) {
        updateData.template_file_name = updates.template.fileName
        updateData.template_page_count = updates.template.pageCount
        updateData.template_extracted_fields = JSON.stringify(updates.template.extractedFields)
        updateData.template_uploaded_at = updates.template.uploadedAt.toISOString()
        
        // Store template file data separately
        const fileData = Buffer.from(updates.template.fileData).toString('base64')
        await supabase
          .from('template_files')
          .upsert({
            section_id: id,
            file_name: updates.template.fileName,
            file_data: fileData
          })
      }

      const { data, error } = await supabase
        .from('sections')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return dbRowToSection(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', user?.id] })
    },
  })

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete template files first
      await supabase
        .from('template_files')
        .delete()
        .eq('section_id', id)

      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sections', user?.id] })
    },
  })

  const getTemplateFile = async (sectionId: string): Promise<ArrayBuffer | null> => {
    const { data, error } = await supabase
      .from('template_files')
      .select('file_data')
      .eq('section_id', sectionId)
      .single()

    if (error || !data) return null

    const buffer = Buffer.from(data.file_data, 'base64')
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  }

  return {
    sections: sectionsQuery.data || [],
    isLoading: sectionsQuery.isLoading,
    error: sectionsQuery.error,
    createSection: createSectionMutation.mutate,
    updateSection: updateSectionMutation.mutate,
    deleteSection: deleteSectionMutation.mutate,
    getTemplateFile,
    isCreating: createSectionMutation.isPending,
    isUpdating: updateSectionMutation.isPending,
    isDeleting: deleteSectionMutation.isPending,
  }
}