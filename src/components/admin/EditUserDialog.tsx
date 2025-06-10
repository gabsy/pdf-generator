import React, { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { useUserManagement } from '../../hooks/useUserManagement'
import { UserProfile } from '../../types'
import { AlertCircle, Crown, User } from 'lucide-react'

interface EditUserDialogProps {
  user: UserProfile
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const { updateUserRole, isUpdatingRole, updateRoleError, currentUserProfile } = useUserManagement()
  const [role, setRole] = useState<'admin' | 'user'>(user.role)

  useEffect(() => {
    setRole(user.role)
  }, [user.role])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (role === user.role) {
      onOpenChange(false)
      return
    }

    updateUserRole(
      { userId: user.id, role },
      {
        onSuccess: () => {
          onOpenChange(false)
        }
      }
    )
  }

  const isCurrentUser = user.id === currentUserProfile?.id
  const canEdit = !isCurrentUser // Prevent users from editing their own role

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user role and permissions for {user.email}
              {isCurrentUser && " (your account)"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Email</Label>
              <div className="p-2 bg-gray-50 rounded border text-gray-700">
                {user.email}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select 
                value={role} 
                onValueChange={(value: 'admin' | 'user') => setRole(value)} 
                disabled={isUpdatingRole || !canEdit}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      User
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {!canEdit && (
                <p className="text-xs text-gray-500">
                  You cannot change your own role. Ask another admin to modify your permissions.
                </p>
              )}
            </div>
          </div>

          {updateRoleError && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-800">{updateRoleError.message}</p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdatingRole}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isUpdatingRole || role === user.role || !canEdit}
            >
              {isUpdatingRole ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}