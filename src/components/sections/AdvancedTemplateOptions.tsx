import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { PDFFieldExtractor } from './PDFFieldExtractor'
import { PDFField, Section } from '../../types'
import { useSections } from '../../hooks/useSections'
import { AlertCircle, Settings, FileText, Plus, Trash2 } from 'lucide-react'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'

interface AdvancedTemplateOptionsProps {
  section: Section
}

export function AdvancedTemplateOptions({ section }: AdvancedTemplateOptionsProps) {
  const { updateSection } = useSections()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<PDFField['type']>('text')
  const [editedFields, setEditedFields] = useState<PDFField[]>(
    section.template?.extractedFields || []
  )
  
  // Update local state when template changes
  React.useEffect(() => {
    if (section.template) {
      setEditedFields(section.template.extractedFields)
    }
  }, [section.template])
  
  const handleFieldsExtracted = (fields: PDFField[]) => {
    if (!section.template) {
      setError('No template found. Please upload a template first.')
      return
    }
    
    if (fields.length === 0) {
      setError('No fields were extracted from the PDF.')
      return
    }
    
    // Update the template with the extracted fields
    updateSection({
      id: section.id,
      updates: {
        template: {
          ...section.template,
          extractedFields: fields
        }
      }
    }, {
      onSuccess: () => {
        setSuccess(`Successfully extracted ${fields.length} fields from the PDF.`)
        setError(null)
        setEditedFields(fields)
      },
      onError: (err: any) => {
        setError(`Failed to update template fields: ${err.message}`)
      }
    })
  }
  
  const handleError = (errorMessage: string) => {
    setError(errorMessage)
    setSuccess(null)
  }
  
  const addManualField = () => {
    if (!newFieldName.trim()) {
      setError('Field name cannot be empty')
      return
    }
    
    // Check for duplicates
    if (editedFields.some(f => f.name === newFieldName.trim())) {
      setError('A field with this name already exists')
      return
    }
    
    const newField: PDFField = {
      name: newFieldName.trim(),
      type: newFieldType,
      required: false,
      options: newFieldType === 'dropdown' || newFieldType === 'radio' ? ['Option 1', 'Option 2'] : undefined
    }
    
    const updatedFields = [...editedFields, newField]
    setEditedFields(updatedFields)
    
    // Save to the server
    if (section.template) {
      updateSection({
        id: section.id,
        updates: {
          template: {
            ...section.template,
            extractedFields: updatedFields
          }
        }
      }, {
        onSuccess: () => {
          setSuccess('Field added successfully')
          setError(null)
          setNewFieldName('')
        },
        onError: (err: any) => {
          setError(`Failed to add field: ${err.message}`)
        }
      })
    }
  }
  
  const deleteField = (fieldName: string) => {
    const updatedFields = editedFields.filter(f => f.name !== fieldName)
    setEditedFields(updatedFields)
    
    // Save to the server
    if (section.template) {
      updateSection({
        id: section.id,
        updates: {
          template: {
            ...section.template,
            extractedFields: updatedFields
          }
        }
      }, {
        onSuccess: () => {
          setSuccess('Field deleted successfully')
          setError(null)
        },
        onError: (err: any) => {
          setError(`Failed to delete field: ${err.message}`)
          // Revert local state on error
          setEditedFields(section.template?.extractedFields || [])
        }
      })
    }
  }
  
  const toggleRequired = (fieldName: string, required: boolean) => {
    const updatedFields = editedFields.map(field => 
      field.name === fieldName ? { ...field, required } : field
    )
    
    setEditedFields(updatedFields)
    
    // Save to the server
    if (section.template) {
      updateSection({
        id: section.id,
        updates: {
          template: {
            ...section.template,
            extractedFields: updatedFields
          }
        }
      }, {
        onSuccess: () => {
          setSuccess('Field updated successfully')
          setError(null)
        },
        onError: (err: any) => {
          setError(`Failed to update field: ${err.message}`)
          // Revert local state on error
          setEditedFields(section.template?.extractedFields || [])
        }
      })
    }
  }
  
  if (!section.template) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900 mb-2">Template Required</h4>
            <p className="text-sm text-yellow-800">
              Please upload a PDF template first before accessing advanced options.
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-white rounded-lg border shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Settings className="h-5 w-5" />
        Advanced Template Options
      </h3>
      
      <p className="text-gray-600 mb-6">
        These tools can help you work with complex PDF templates or troubleshoot field detection issues.
      </p>
      
      {error && (
        <div className="flex items-center gap-2 p-4 mb-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="flex items-center gap-2 p-4 mb-4 bg-green-50 border border-green-200 rounded-lg">
          <FileText className="h-5 w-5 text-green-600" />
          <p className="text-green-800">{success}</p>
        </div>
      )}
      
      <Tabs defaultValue="field-extractor">
        <TabsList className="mb-4">
          <TabsTrigger value="field-extractor">Field Extractor</TabsTrigger>
          <TabsTrigger value="field-editor">Field Editor</TabsTrigger>
        </TabsList>
        
        <TabsContent value="field-extractor">
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              If your PDF fields weren't detected correctly during upload, you can try this alternative extraction method.
              This is especially useful for XFA forms or complex PDFs.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">About XFA Forms</h4>
                  <p className="text-sm text-blue-800">
                    Some PDFs use XML Forms Architecture (XFA) which can be difficult to process. 
                    This tool attempts to extract field names from such forms, but may not be able to 
                    determine field types accurately.
                  </p>
                </div>
              </div>
            </div>
            
            <PDFFieldExtractor 
              onFieldsExtracted={handleFieldsExtracted}
              onError={handleError}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="field-editor">
          <div className="space-y-4">
            <p className="text-sm text-gray-700 mb-4">
              You can manually add, edit, or remove fields if the automatic detection didn't work correctly.
              This is useful for PDFs where field detection fails or for adding virtual fields.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">Current Template Fields</h4>
                  <p className="text-sm text-blue-800">
                    Your template has {editedFields.length} fields.
                    {editedFields.length === 0 && " You can add fields manually below."}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Add new field form */}
            <div className="border rounded-lg p-4 mb-6">
              <h4 className="font-medium text-gray-900 mb-3">Add New Field</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="new-field-name">Field Name</Label>
                  <Input
                    id="new-field-name"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="Enter field name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="new-field-type">Field Type</Label>
                  <Select
                    value={newFieldType}
                    onValueChange={(value) => setNewFieldType(value as PDFField['type'])}
                  >
                    <SelectTrigger id="new-field-type" className="mt-1">
                      <SelectValue placeholder="Select field type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="radio">Radio Button</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={addManualField}
                    className="flex items-center gap-2 w-full"
                  >
                    <Plus className="h-4 w-4" />
                    Add Field
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Fields table */}
            {editedFields.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Required</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editedFields.map((field) => (
                      <TableRow key={field.name}>
                        <TableCell className="font-medium">{field.name}</TableCell>
                        <TableCell>{field.type}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`required-${field.name}`}
                              checked={field.required}
                              onCheckedChange={(checked) => toggleRequired(field.name, checked)}
                            />
                            <Label htmlFor={`required-${field.name}`}>
                              {field.required ? 'Required' : 'Optional'}
                            </Label>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteField(field.name)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 border rounded-lg">
                <p className="text-gray-500">No fields have been added yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}