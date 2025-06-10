import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { UserProfile } from '../types'
import { Database } from '../types/database'

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']
type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']

function dbRowToUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by || undefined
  }
}

export function useUserManagement() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Check if current user is admin
  const isAdminQuery = useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user) return false
      
      const { data, error } = await supabase.rpc('is_admin')
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  // Get current user profile
  const currentUserProfileQuery = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user) return null
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error
      return data ? dbRowToUserProfile(data) : null
    },
    enabled: !!user,
  })

  // Get all user profiles (admin only)
  const allUsersQuery = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data.map(dbRowToUserProfile)
    },
    enabled: isAdminQuery.data === true,
  })

  // Create new user (admin only)
  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, role }: { email: string; password: string; role: 'admin' | 'user' }) => {
      // First create the auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      })

      if (authError) throw authError

      // Then create the profile (this should happen automatically via trigger, but we'll ensure it)
      const profileData: UserProfileInsert = {
        id: authData.user.id,
        email,
        role,
        created_by: user?.id
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .upsert(profileData)
        .select()
        .single()

      if (error) throw error
      return dbRowToUserProfile(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
    },
  })

  // Update user role (admin only)
  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'admin' | 'user' }) => {
      const updateData: UserProfileUpdate = { role }

      const { data, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error
      return dbRowToUserProfile(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
    },
  })

  // Delete user (admin only)
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete from auth.users (this will cascade to user_profiles)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId)
      if (authError) throw authError

      // Also delete from user_profiles if it still exists
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)

      // Don't throw error if profile doesn't exist (already deleted by cascade)
      if (error && !error.message.includes('No rows found')) {
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
    },
  })

  return {
    // Current user data
    isAdmin: isAdminQuery.data || false,
    currentUserProfile: currentUserProfileQuery.data,
    isLoadingProfile: currentUserProfileQuery.isLoading,

    // All users data (admin only)
    allUsers: allUsersQuery.data || [],
    isLoadingUsers: allUsersQuery.isLoading,

    // Mutations
    createUser: createUserMutation.mutate,
    updateUserRole: updateUserRoleMutation.mutate,
    deleteUser: deleteUserMutation.mutate,

    // Loading states
    isCreatingUser: createUserMutation.isPending,
    isUpdatingRole: updateUserRoleMutation.isPending,
    isDeletingUser: deleteUserMutation.isPending,

    // Errors
    createUserError: createUserMutation.error,
    updateRoleError: updateUserRoleMutation.error,
    deleteUserError: deleteUserMutation.error,
  }
}