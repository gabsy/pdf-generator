import React, { useState } from 'react'
import { Search, Download, Users, FileText } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Section, User } from '../../types'
import { useSections } from '../../hooks/useSections'
import { useSectionsStore } from '../../store/sections'
import { PDFGenerationService } from '../../services/pdfGeneration'

interface UsersListProps {
  section: Section
}

export function UsersList({ section }: UsersListProps) {
  const { getTemplateFile } = useSections()
  const { generationProgress, setGenerationProgress, resetGenerationProgress } = useSectionsStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

  const filteredUsers = section.users.filter(user => {
    const searchLower = searchTerm.toLowerCase()
    return Object.values(user).some(value => 
      String(value).toLowerCase().includes(searchLower)
    )
  })

  const handleUserSelect = (userId: string) => {
    const newSelection = new Set(selectedUsers)
    if (newSelection.has(userId)) {
      newSelection.delete(userId)
    } else {
      newSelection.add(userId)
    }
    setSelectedUsers(newSelection)
  }

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(filteredUsers.map(user => user.id)))
    }
  }

  const generatePDFs = async () => {
    const selectedUserData = section.users.filter(user => selectedUsers.has(user.id))
    
    if (!section.template || selectedUserData.length === 0) return

    // Get the actual template file data
    const templateFileData = await getTemplateFile(section.id)
    if (!templateFileData) {
      console.error('Could not load template file data')
      return
    }

    const templateWithData = {
      ...section.template,
      fileData: templateFileData
    }

    setGenerationProgress({
      current: 0,
      total: selectedUserData.length,
      status: 'processing'
    })

    try {
      const pdfService = new PDFGenerationService()
      
      if (selectedUserData.length === 1) {
        // Generate single PDF
        const pdfBytes = await pdfService.generateSinglePDF(
          templateWithData,
          selectedUserData[0],
          section.fieldMappings
        )
        
        // Download the PDF
        const blob = new Blob([pdfBytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${section.name}_${selectedUserData[0].id}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // Generate multiple PDFs and create ZIP
        const zipBlob = await pdfService.generateBulkPDFs(
          templateWithData,
          selectedUserData,
          section.fieldMappings,
          section.name,
          (progress) => setGenerationProgress(progress)
        )
        
        // Download the ZIP
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${section.name}_pdfs.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      setGenerationProgress({
        current: selectedUserData.length,
        total: selectedUserData.length,
        status: 'completed'
      })

      // Reset selection and progress after a delay
      setTimeout(() => {
        setSelectedUsers(new Set())
        resetGenerationProgress()
      }, 2000)

    } catch (error) {
      console.error('Error generating PDFs:', error)
      setGenerationProgress({
        current: 0,
        total: selectedUserData.length,
        status: 'error',
        error: 'Failed to generate PDFs'
      })
    }
  }

  const getDataPreview = (user: User) => {
    const entries = Object.entries(user).filter(([key]) => key !== 'id')
    return entries.slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(', ')
  }

  if (!section.template) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Template Required</h3>
          <p className="text-gray-600">
            Please upload and configure a PDF template first.
          </p>
        </div>
      </div>
    )
  }

  if (section.users.length === 0) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Users Data</h3>
          <p className="text-gray-600">
            Upload CSV data and configure field mappings to see users here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Generation Progress */}
      {generationProgress.status === 'processing' && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Generating PDFs</h3>
            <Badge variant="secondary">
              {generationProgress.current}/{generationProgress.total}
            </Badge>
          </div>
          <Progress 
            value={(generationProgress.current / generationProgress.total) * 100} 
            className="w-full"
          />
          <p className="text-sm text-gray-600 mt-2">
            Processing {generationProgress.current} of {generationProgress.total} PDFs...
          </p>
        </div>
      )}

      {/* Selection and Generation Panel */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                {selectedUsers.size > 0 ? `${selectedUsers.size} selected` : `${section.users.length} total users`}
              </span>
            </div>
            {selectedUsers.size > 0 && (
              <Badge variant="default">
                {selectedUsers.size} user{selectedUsers.size > 1 ? 's' : ''} selected
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setSelectedUsers(new Set())}
              variant="outline"
              size="sm"
              disabled={selectedUsers.size === 0}
            >
              Clear Selection
            </Button>
            <Button
              onClick={generatePDFs}
              disabled={selectedUsers.size === 0 || generationProgress.status === 'processing'}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Generate PDFs ({selectedUsers.size})
            </Button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-gray-600">
              Showing {filteredUsers.length} of {section.users.length} users
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>User ID</TableHead>
              <TableHead>Data Preview</TableHead>
              <TableHead>Fields</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedUsers.has(user.id)}
                    onCheckedChange={() => handleUserSelect(user.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">{user.id}</TableCell>
                <TableCell className="max-w-md truncate text-gray-600">
                  {getDataPreview(user)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {Object.keys(user).length - 1} fields
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}