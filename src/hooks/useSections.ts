import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Section, PDFTemplate, User, FieldMapping } from '../types'
import { Database } from '../types/database'

type SectionRow = Database['public']['Tables']['sections']['Row']
type SectionInsert = Database['public']['Tables']['sections']['Insert']
type SectionUpdate = Database['public']['Tables']['sections']['Update']

// Browser-compatible ArrayBuffer to base64 conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Browser-compatible base64 to ArrayBuffer conversion
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

// Convert database row to Section type
function dbRowToSection(row: SectionRow): Section {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    createdAt: new Date(row.created_at!),
    status: row.status || 'draft',
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
      console.log('Updating section with:', { id, updates })
      
      const updateData: SectionUpdate = {}
      
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.status !== undefined) updateData.status = updates.status
      if (updates.users !== undefined) updateData.users_data = JSON.stringify(updates.users)
      if (updates.fieldMappings !== undefined) updateData.field_mappings = JSON.stringify(updates.fieldMappings)
      
      if (updates.template) {
        updateData.template_file_name = updates.template.fileName
        updateData.template_page_count = updates.template.pageCount
        updateData.template_extracted_fields = JSON.stringify(updates.template.extractedFields)
        updateData.template_uploaded_at = updates.template.uploadedAt.toISOString()
        
        console.log('Storing template file data...')
        
        // Store template file data separately using browser-compatible conversion
        const fileData = arrayBufferToBase64(updates.template.fileData)
        const { error: fileError } = await supabase
          .from('template_files')
          .upsert({
            section_id: id,
            file_name: updates.template.fileName,
            file_data: fileData
          }, {
            onConflict: 'section_id'
          })
        
        if (fileError) {
          console.error('Error storing template file:', fileError)
          throw fileError
        }
        
        console.log('Template file stored successfully')
      }

      console.log('Updating section with data:', updateData)

      const { data, error } = await supabase
        .from('sections')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Error updating section:', error)
        throw error
      }
      
      console.log('Section updated successfully:', data)
      return dbRowToSection(data)
    },
    onSuccess: (updatedSection) => {
      console.log('Section update successful, invalidating queries')
      // Invalidate and refetch the sections query
      queryClient.invalidateQueries({ queryKey: ['sections', user?.id] })
      
      // Also update the specific section in the cache
      queryClient.setQueryData(['sections', user?.id], (oldData: Section[] | undefined) => {
        if (!oldData) return [updatedSection]
        return oldData.map(section => 
          section.id === updatedSection.id ? updatedSection : section
        )
      })
    },
    onError: (error) => {
      console.error('Section update failed:', error)
    }
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
    try {
      const { data, error } = await supabase
        .from('template_files')
        .select('file_data')
        .eq('section_id', sectionId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error || !data || data.length === 0) {
        console.error('Error fetching template file:', error)
        return null
      }

      // Use browser-compatible conversion from base64 to ArrayBuffer
      return base64ToArrayBuffer(data[0].file_data)
    } catch (error) {
      console.error('Error processing template file:', error)
      return null
    }
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