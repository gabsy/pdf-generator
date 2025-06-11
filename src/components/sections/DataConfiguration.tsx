import React, { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight, Download, RefreshCw, Users } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'
import { Section, CSVParseResult, User } from '../../types'
import { useSections } from '../../hooks/useSections'
import { downloadSampleCSV } from '../../utils/sampleCSVData'
import Papa from 'papaparse'
import { generateId } from '../../lib/utils'

interface DataConfigurationProps {
  section: Section
}

export function DataConfiguration({ section }: DataConfigurationProps) {
  const { updateSection, isUpdating } = useSections()
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasImportedUsers, setHasImportedUsers] = useState(false)
  const [importMode, setImportMode] = useState<'new' | 'replace'>('new')

  // Check if users have been imported and we should show the mapping interface
  useEffect(() => {
    setHasImportedUsers(section.users.length > 0)
  }, [section.users.length])

  const processCSV = async (file: File) => {
    setIsProcessing(true)
    setError(null)

    try {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError('CSV parsing errors: ' + results.errors.map(e => e.message).join(', '))
            return
          }

          const parseResult: CSVParseResult = {
            data: results.data,
            headers: results.meta.fields || [],
            errors: results.errors
          }

          setCsvData(parseResult)
          setIsProcessing(false)
        },
        error: (error) => {
          setError('Failed to parse CSV: ' + error.message)
          setIsProcessing(false)
        }
      })
    } catch (err) {
      setError('Failed to process CSV file')
      setIsProcessing(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      processCSV(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'text/plain': ['.csv']
    },
    maxFiles: 1,
    disabled: isProcessing || isUpdating
  })

  const handleMappingChange = (pdfField: string, csvColumn: string) => {
    const existingMappings = section.fieldMappings || []
    const mappingIndex = existingMappings.findIndex(m => m.pdfFieldName === pdfField)
    
    // Convert the special '--none--' value back to empty string for storage
    const actualCsvColumn = csvColumn === '--none--' ? '' : csvColumn
    
    let newMappings
    if (mappingIndex >= 0) {
      newMappings = existingMappings.map((mapping, index) =>
        index === mappingIndex 
          ? { ...mapping, csvColumnName: actualCsvColumn }
          : mapping
      )
    } else {
      const pdfFieldInfo = section.template?.extractedFields.find(f => f.name === pdfField)
      newMappings = [...existingMappings, {
        pdfFieldName: pdfField,
        csvColumnName: actualCsvColumn,
        defaultValue: '',
        isRequired: pdfFieldInfo?.required || false
      }]
    }
    
    updateSection({
      id: section.id,
      updates: { fieldMappings: newMappings }
    })
  }

  const handleDefaultValueChange = (pdfField: string, defaultValue: string) => {
    const existingMappings = section.fieldMappings || []
    const mappingIndex = existingMappings.findIndex(m => m.pdfFieldName === pdfField)
    
    if (mappingIndex >= 0) {
      const newMappings = existingMappings.map((mapping, index) =>
        index === mappingIndex 
          ? { ...mapping, defaultValue }
          : mapping
      )
      
      updateSection({
        id: section.id,
        updates: { fieldMappings: newMappings }
      })
    }
  }

  const importUsers = async () => {
    if (!csvData) return

    const newUsers: User[] = csvData.data.map((row: any) => ({
      id: generateId(),
      ...row
    }))

    // Determine final users list based on import mode
    const finalUsers = importMode === 'replace' ? newUsers : [...section.users, ...newUsers]

    const hasTemplate = section.template
    const newStatus = hasTemplate && finalUsers.length > 0 ? 'ready' : hasTemplate ? 'template-configured' : 'users-loaded'

    // Use a promise to handle the mutation
    await new Promise<void>((resolve, reject) => {
      updateSection(
        {
          id: section.id,
          updates: {
            users: finalUsers,
            status: newStatus,
            // Reset field mappings if replacing users and the CSV structure might be different
            ...(importMode === 'replace' ? { fieldMappings: [] } : {})
          }
        },
        {
          onSuccess: () => {
            setCsvData(null)
            setHasImportedUsers(true)
            setImportMode('new') // Reset to default mode
            resolve()
          },
          onError: (error: any) => {
            setError(`Failed to import users: ${error.message}`)
            reject(error)
          }
        }
      )
    })
  }

  const clearUsers = () => {
    if (confirm('Are you sure you want to clear all imported users? This will also reset the field mappings.')) {
      updateSection({
        id: section.id,
        updates: {
          users: [],
          fieldMappings: [],
          status: section.template ? 'template-configured' : 'draft'
        }
      })
      setHasImportedUsers(false)
    }
  }

  const exportCurrentUsers = () => {
    if (section.users.length === 0) return

    // Get all unique keys from all users (excluding id)
    const allKeys = new Set<string>()
    section.users.forEach(user => {
      Object.keys(user).forEach(key => {
        if (key !== 'id') allKeys.add(key)
      })
    })

    const headers = Array.from(allKeys)
    const csvContent = [
      headers.join(','),
      ...section.users.map(user => 
        headers.map(header => `"${user[header] || ''}"`).join(',')
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${section.name}_current_users.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getMappingStatus = () => {
    if (!section.template) return null

    const requiredFields = section.template.extractedFields.filter(f => f.required)
    const mappedFields = section.fieldMappings.filter(m => m.csvColumnName || m.defaultValue)
    
    return {
      total: section.template.extractedFields.length,
      mapped: mappedFields.length,
      required: requiredFields.length,
      requiredMapped: requiredFields.filter(f => 
        section.fieldMappings.some(m => m.pdfFieldName === f.name && (m.csvColumnName || m.defaultValue))
      ).length
    }
  }

  const mappingStatus = getMappingStatus()

  return (
    <div className="space-y-6">
      {/* CSV Upload Section */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {hasImportedUsers ? 'Update User Data' : 'CSV Data Import'}
          </h2>
          {hasImportedUsers && (
            <div className="flex items-center gap-2">
              <Badge variant="default" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {section.users.length} Users
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={exportCurrentUsers}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Current
              </Button>
            </div>
          )}
        </div>
        
        {!csvData ? (
          <div className="space-y-4">
            {/* Import Mode Selection - Only show if users already exist */}
            {hasImportedUsers && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-3">Import Mode</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="importMode"
                      value="new"
                      checked={importMode === 'new'}
                      onChange={(e) => setImportMode(e.target.value as 'new' | 'replace')}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-blue-800">
                      <strong>Add to existing users</strong> - Keep current users and add new ones
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={(e) => setImportMode(e.target.value as 'new' | 'replace')}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-blue-800">
                      <strong>Replace all users</strong> - Remove current users and import new ones
                    </span>
                  </label>
                </div>
                {importMode === 'replace' && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    <strong>Warning:</strong> This will remove all {section.users.length} existing users and reset field mappings.
                  </div>
                )}
              </div>
            )}

            {/* Sample CSV Download */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-900 mb-2">Need Sample Data?</h4>
                  <p className="text-sm text-blue-800 mb-3">
                    Download sample CSV data that includes realistic employee information with all field types.
                    You can use this data to test the application or as a template for your own data.
                  </p>
                  <Button
                    onClick={() => downloadSampleCSV('sample_employee_data.csv')}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Sample CSV Data
                  </Button>
                </div>
              </div>
            </div>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              } ${(isProcessing || isUpdating) ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input {...getInputProps()} />
              {hasImportedUsers ? (
                <RefreshCw className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              ) : (
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              )}
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive 
                  ? 'Drop your CSV here' 
                  : hasImportedUsers 
                    ? 'Upload New CSV Data'
                    : 'Upload CSV Data'
                }
              </p>
              <p className="text-gray-600 mb-4">
                {hasImportedUsers 
                  ? `${importMode === 'replace' ? 'Replace' : 'Add to'} your current ${section.users.length} users with new CSV data`
                  : 'Upload a CSV file with user data. You can add a PDF template later for automated form filling.'
                }
              </p>
              <Button variant="outline" disabled={isProcessing || isUpdating}>
                {isProcessing ? 'Processing...' : 'Choose File'}
              </Button>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* Info about workflow - Only show for new users */}
            {!hasImportedUsers && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">How it works:</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Upload your CSV file with user data</li>
                  <li>• Optionally add a PDF template with form fields</li>
                  <li>• Map CSV columns to PDF fields (if template is added)</li>
                  <li>• Generate personalized PDFs for each user</li>
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">CSV Data Loaded</p>
                  <p className="text-sm text-blue-700">
                    {csvData.data.length} rows • {csvData.headers.length} columns
                    {hasImportedUsers && (
                      <span className="ml-2">
                        ({importMode === 'replace' 
                          ? `Will replace ${section.users.length} existing users`
                          : `Will add to ${section.users.length} existing users`
                        })
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button onClick={() => setCsvData(null)} variant="outline" size="sm">
                Upload Different File
              </Button>
            </div>

            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">Column Preview</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {csvData.headers.map((header, index) => (
                  <Badge key={index} variant="outline" className="justify-center">
                    {header}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={importUsers}
                disabled={isUpdating}
                className="flex items-center gap-2"
              >
                {isUpdating 
                  ? 'Importing...' 
                  : importMode === 'replace' 
                    ? `Replace ${section.users.length} Users`
                    : hasImportedUsers 
                      ? `Add ${csvData.data.length} Users`
                      : 'Import Users'
                }
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Users Summary - Show if users are imported */}
      {hasImportedUsers && !csvData && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Current Users</h3>
              <p className="text-gray-600">
                {section.users.length} users imported and ready for processing
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {section.users.length} Users Ready
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={clearUsers}
                disabled={isUpdating}
                className="text-red-600 hover:text-red-700"
              >
                Clear All Users
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Field Mapping Section - Only show if template exists and users are imported */}
      {section.template && hasImportedUsers && !csvData && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Field Mapping</h3>
            {mappingStatus && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">
                  {mappingStatus.mapped}/{mappingStatus.total} fields mapped
                </span>
                {mappingStatus.requiredMapped < mappingStatus.required && (
                  <Badge variant="destructive">
                    {mappingStatus.required - mappingStatus.requiredMapped} required unmapped
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <p className="text-gray-600 mb-4">
            Map your CSV columns to PDF form fields. You can also set default values for unmapped fields.
          </p>
          
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PDF Field</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>CSV Column</TableHead>
                  <TableHead>Default Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.template.extractedFields.map((field) => {
                  const mapping = section.fieldMappings.find(m => m.pdfFieldName === field.name)
                  const isMapped = mapping && (mapping.csvColumnName || mapping.defaultValue)
                  
                  return (
                    <TableRow key={field.name}>
                      <TableCell className="font-medium">
                        {field.name}
                        {field.required && (
                          <Badge variant="destructive\" className=\"ml-2 text-xs">
                            Required
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{field.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping?.csvColumnName || '--none--'}
                          onValueChange={(value) => handleMappingChange(field.name, value)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select CSV column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="--none--">No mapping</SelectItem>
                            {Object.keys(section.users[0] || {}).filter(key => key !== 'id').map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Default value..."
                          value={mapping?.defaultValue || ''}
                          onChange={(e) => handleDefaultValueChange(field.name, e.target.value)}
                          className="w-full"
                          disabled={isUpdating}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={isMapped ? 'default' : 'outline'}>
                          {isMapped ? 'Mapped' : 'Not mapped'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Template Recommendation - Show if users imported but no template */}
      {hasImportedUsers && !section.template && !csvData && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-yellow-900 mb-2">Add a PDF Template for Automated Generation</h4>
              <p className="text-sm text-yellow-800 mb-3">
                You have imported user data successfully! To generate personalized PDFs, consider adding a PDF template 
                with form fields in the Template tab. This will allow you to automatically fill forms with your user data.
              </p>
              <p className="text-xs text-yellow-700">
                Without a template, you can still view and manage your user data, but PDF generation won't be available.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}