import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { AuthPage } from './components/auth/AuthPage'
import { Header } from './components/layout/Header'
import { SectionsDashboard } from './components/sections/SectionsDashboard'
import { SectionDetail } from './components/sections/SectionDetail'

const queryClient = new QueryClient()

function AppContent() {
  const { user, loading } = useAuth()
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)

  const handleSelectSection = (sectionId: string) => {
    setSelectedSectionId(sectionId)
  }

  const handleBackToDashboard = () => {
    setSelectedSectionId(null)
  }

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main>
        {selectedSectionId ? (
          <SectionDetail
            sectionId={selectedSectionId}
            onBack={handleBackToDashboard}
          />
        ) : (
          <SectionsDashboard onSelectSection={handleSelectSection} />
        )}
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