import React, { useState } from 'react'
import { Plus, Search, Edit, Trash2, Users, FileText, Eye } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { useSections } from '../../hooks/useSections'
import { CreateSectionDialog } from './CreateSectionDialog'
import { format } from 'date-fns'

interface SectionsDashboardProps {
  onSelectSection: (sectionId: string) => void
}

export function SectionsDashboard({ onSelectSection }: SectionsDashboardProps) {
  const { sections, deleteSection, isLoading } = useSections()
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  const filteredSections = sections.filter(section =>
    section.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    section.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

  const handleDeleteSection = (sectionId: string) => {
    if (confirm('Are you sure you want to delete this section?')) {
      deleteSection(sectionId)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading sections...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PDF Generator Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your PDF generation sections and workflows</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create New Section
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search sections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{filteredSections.length} sections</span>
        </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Users</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No sections match your search.' : 'No sections created yet. Create your first section to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredSections.map((section) => (
                <TableRow key={section.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{section.name}</TableCell>
                  <TableCell className="text-gray-600 max-w-xs truncate">
                    {section.description}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span>{section.users.length}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span>{section.template ? 'Configured' : 'Not set'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(section.status)}>
                      {getStatusText(section.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {format(section.createdAt, 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectSection(section.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSection(section.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CreateSectionDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  )
}