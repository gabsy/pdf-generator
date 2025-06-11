import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { PDFFieldExtractor } from './PDFFieldExtractor'
import { PDFField, Section } from '../../types'
import { useSections } from '../../hooks/useSections'
import { AlertCircle, Settings, FileText, Plus, Trash2, Edit3, Save, X } from 'lucide-react'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Switch } from '../ui/switch'
import { Label } from '../ui/label'

interface AdvancedTemplateOptionsProps {
  section: Section
}

export function AdvancedTemplateOptions({ section }: AdvancedTemplateOptionsProps) {
  const { updateSection, isUpdating } = useSections()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newFieldName, setNewFieldName] = useState('')
  const [newFieldType, setNewFieldType] = useState<PDFField['type']>('text')
  const [editedFields, setEditedFields] = useState<PDFField[]>(
    section.template?.extractedFields || []
  )
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editFieldName, setEditFieldName] = useState('')
  
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
        },
        // Reset field mappings when fields change to avoid conflicts
        fieldMappings: []
      }
    }, {
      onSuccess: () => {
        setSuccess(`Successfully extracted ${fields.length} fields from the PDF. Field mappings have been reset.`)
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
          // Revert local state on error
          setEditedFields(section.template?.extractedFields || [])
        }
      })
    }
  }
  
  const deleteField = (fieldName: string) => {
    if (!confirm(`Are you sure you want to delete the field "${fieldName}"? This will also remove any mappings for this field.`)) {
      return
    }
    
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
          },
          // Remove field mappings for the deleted field
          fieldMappings: section.fieldMappings.filter(m => m.pdfFieldName !== fieldName)
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
  
  const startEditingField = (fieldName: string) => {
    setEditingField(fieldName)
    setEditFieldName(fieldName)
  }
  
  const saveFieldEdit = () => {
    if (!editFieldName.trim()) {
      setError('Field name cannot be empty')
      return
    }
    
    if (editingField !== editFieldName && editedFields.some(f => f.name === editFieldName.trim())) {
      setError('A field with this name already exists')
      return
    }
    
    const updatedFields = editedFields.map(field => 
      field.name === editingField ? { ...field, name: editFieldName.trim() } : field
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
          },
          // Update field mappings to use the new field name
          fieldMappings: section.fieldMappings.map(m => 
            m.pdfFieldName === editingField ? { ...m, pdfFieldName: editFieldName.trim() } : m
          )
        }
      }, {
        onSuccess: () => {
          setSuccess('Field updated successfully')
          setError(null)
          setEditingField(null)
          setEditFieldName('')
        },
        onError: (err: any) => {
          setError(`Failed to update field: ${err.message}`)
          // Revert local state on error
          setEditedFields(section.template?.extractedFields || [])
          setEditingField(null)
          setEditFieldName('')
        }
      })
    }
  }
  
  const cancelFieldEdit = () => {
    setEditingField(null)
    setEditFieldName('')
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
  
  const clearAllFields = () => {
    if (!confirm('Are you sure you want to clear all fields? This will remove all field mappings as well.')) {
      return
    }
    
    setEditedFields([])
    
    // Save to the server
    if (section.template) {
      updateSection({
        id: section.id,
        updates: {
          template: {
            ...section.template,
            extractedFields: []
          },
          fieldMappings: []
        }
      }, {
        onSuccess: () => {
          setSuccess('All fields cleared successfully')
          setError(null)
        },
        onError: (err: any) => {
          setError(`Failed to clear fields: ${err.message}`)
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
              This is especially useful for XFA forms, complex PDFs, or forms with many fields.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">Enhanced Field Detection</h4>
                  <p className="text-sm text-blue-800">
                    This tool uses multiple detection methods including XFA analysis, annotation parsing, 
                    and deep content scanning to find form fields that might be missed by standard detection.
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                You can manually add, edit, or remove fields if the automatic detection didn't work correctly.
                This is useful for PDFs where field detection fails or for adding virtual fields.
              </p>
              {editedFields.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllFields}
                  disabled={isUpdating}
                  className="text-red-600 hover:text-red-700"
                >
                  Clear All Fields
                </Button>
              )}
            </div>
            
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
                    disabled={isUpdating}
                  />
                </div>
                <div>
                  <Label htmlFor="new-field-type">Field Type</Label>
                  <Select
                    value={newFieldType}
                    onValueChange={(value) => setNewFieldType(value as PDFField['type'])}
                    disabled={isUpdating}
                  >
                    <SelectTrigger id="new-field-type" className="mt-1">
                      <SelectValue placeholder="Select field type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
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
                    disabled={isUpdating || !newFieldName.trim()}
                  >
                    <Plus className="h-4 w-4" />
                    {isUpdating ? 'Adding...' : 'Add Field'}
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
                        <TableCell className="font-medium">
                          {editingField === field.name ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editFieldName}
                                onChange={(e) => setEditFieldName(e.target.value)}
                                className="h-8"
                                disabled={isUpdating}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={saveFieldEdit}
                                disabled={isUpdating || !editFieldName.trim()}
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelFieldEdit}
                                disabled={isUpdating}
                                className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{field.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditingField(field.name)}
                                disabled={isUpdating}
                                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                              >
                                <Edit3 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">{field.type}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`required-${field.name}`}
                              checked={field.required}
                              onCheckedChange={(checked) => toggleRequired(field.name, checked)}
                              disabled={isUpdating}
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
                            disabled={isUpdating}
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
                <p className="text-sm text-gray-400 mt-1">
                  Use the form above to add fields manually, or try the Field Extractor tab.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}