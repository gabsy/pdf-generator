import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useUserManagement } from './hooks/useUserManagement'
import { AuthPage } from './components/auth/AuthPage'
import { Header } from './components/layout/Header'
import { SectionsDashboard } from './components/sections/SectionsDashboard'
import { SectionDetail } from './components/sections/SectionDetail'
import { UserManagement } from './components/admin/UserManagement'

const queryClient = new QueryClient()

function AppContent() {
  const { user, loading } = useAuth()
  const { isAdmin, isLoadingProfile } = useUserManagement()
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'users'>('dashboard')

  const handleSelectSection = (sectionId: string) => {
    setSelectedSectionId(sectionId)
  }

  const handleBackToDashboard = () => {
    setSelectedSectionId(null)
    setCurrentPage('dashboard')
  }

  const handleNavigate = (page: 'dashboard' | 'users') => {
    setCurrentPage(page)
    setSelectedSectionId(null)
  }

  if (loading || isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  const renderContent = () => {
    if (selectedSectionId) {
      return (
        <SectionDetail
          sectionId={selectedSectionId}
          onBack={handleBackToDashboard}
        />
      )
    }

    switch (currentPage) {
      case 'users':
        return isAdmin ? <UserManagement /> : <SectionsDashboard onSelectSection={handleSelectSection} />
      case 'dashboard':
      default:
        return <SectionsDashboard onSelectSection={handleSelectSection} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        onNavigate={handleNavigate} 
        currentPage={selectedSectionId ? 'dashboard' : currentPage}
      />
      <main>
        {renderContent()}
      </main>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App