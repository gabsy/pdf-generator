import React, { useEffect, useState } from 'react'
import { ArrowLeft, FileText, Users, Settings, Wrench } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { useSections } from '../../hooks/useSections'
import { useSectionsStore } from '../../store/sections'
import { TemplateConfiguration } from './TemplateConfiguration'
import { DataConfiguration } from './DataConfiguration'
import { UsersList } from './UsersList'
import { AdvancedTemplateOptions } from './AdvancedTemplateOptions'

interface SectionDetailProps {
  sectionId: string
  onBack: () => void
}

export function SectionDetail({ sectionId, onBack }: SectionDetailProps) {
  const { sections, isLoading } = useSections()
  const { setCurrentSection } = useSectionsStore()
  const [activeTab, setActiveTab] = useState('template')

  const currentSection = sections.find(s => s.id === sectionId)

  useEffect(() => {
    setCurrentSection(sectionId)
    return () => setCurrentSection(null)
  }, [sectionId, setCurrentSection])

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading section...</p>
        </div>
      </div>
    )
  }

  if (!currentSection) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <p className="text-gray-500">Section not found</p>
          <Button onClick={onBack} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'outline'
      case 'template-configured':
        return 'secondary'
      case 'users-loaded':
        return 'secondary'
      case 'ready':
        return 'default'
      default:
        return 'outline'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft'
      case 'template-configured':
        return 'Template Ready'
      case 'users-loaded':
        return 'Users Loaded'
      case 'ready':
        return 'Ready'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentSection.name}</h1>
          <p className="text-gray-600 mb-4">{currentSection.description}</p>
          <div className="flex items-center gap-4">
            <Badge variant={getStatusColor(currentSection.status)}>
              {getStatusText(currentSection.status)}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              <span>{currentSection.users.length} users</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="h-4 w-4" />
              <span>{currentSection.template ? 'Template configured' : 'No template'}</span>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full lg:w-auto grid-cols-4">
          <TabsTrigger value="template" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Template
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Data Mapping
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users & Generation
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="mt-6">
          <TemplateConfiguration section={currentSection} />
        </TabsContent>

        <TabsContent value="data" className="mt-6">
          <DataConfiguration section={currentSection} />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UsersList section={currentSection} />
        </TabsContent>

        <TabsContent value="advanced" className="mt-6">
          <AdvancedTemplateOptions section={currentSection} />
        </TabsContent>
      </Tabs>
    </div>
  )
}