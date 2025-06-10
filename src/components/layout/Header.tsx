import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useUserManagement } from '../../hooks/useUserManagement'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { FileText, LogOut, User, Settings, Crown } from 'lucide-react'

interface HeaderProps {
  onNavigate?: (page: 'dashboard' | 'users') => void
  currentPage?: 'dashboard' | 'users'
}

export function Header({ onNavigate, currentPage = 'dashboard' }: HeaderProps) {
  const { user, signOut } = useAuth()
  const { isAdmin, currentUserProfile } = useUserManagement()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">PDF Generator</h1>
          </div>
          
          {onNavigate && (
            <nav className="flex items-center gap-4">
              <Button
                variant={currentPage === 'dashboard' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onNavigate('dashboard')}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Dashboard
              </Button>
              {isAdmin && (
                <Button
                  variant={currentPage === 'users' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onNavigate('users')}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  User Management
                </Button>
              )}
            </nav>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="h-4 w-4" />
            <span>{user?.email}</span>
            {currentUserProfile && (
              <Badge variant={currentUserProfile.role === 'admin' ? 'default' : 'secondary'} className="flex items-center gap-1">
                {currentUserProfile.role === 'admin' ? <Crown className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {currentUserProfile.role.charAt(0).toUpperCase() + currentUserProfile.role.slice(1)}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  )
}