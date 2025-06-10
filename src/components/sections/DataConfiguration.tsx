import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Input } from '../ui/input'
import { Section, CSVParseResult, User } from '../../types'
import { useSections } from '../../hooks/useSections'
import Papa from 'papaparse'
import { generateId } from '../../lib/utils'

interface DataConfigurationProps {
  section: Section
}

export function DataConfiguration({ section }: DataConfigurationProps) {
  const { updateSection } = useSections()
  const [csvData, setCsvData] = useState<CSVParseResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    maxFiles: 1
  })

  const handleMappingChange = (pdfField: string, csvColumn: string) => {
    const existingMappings = section.fieldMappings || []
    const mappingIndex = existingMappings.findIndex(m => m.pdfFieldName === pdfField)
    
    let newMappings
    if (mappingIndex >= 0) {
      newMappings = existingMappings.map((mapping, index) =>
        index === mappingIndex 
          ? { ...mapping, csvColumnName: csvColumn }
          : mapping
      )
    } else {
      const pdfFieldInfo = section.template?.extractedFields.find(f => f.name === pdfField)
      newMappings = [...existingMappings, {
        pdfFieldName: pdfField,
        csvColumnName: csvColumn,
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

  const importUsers = () => {
    if (!csvData) return

    const users: User[] = csvData.data.map((row: any) => ({
      id: generateId(),
      ...row
    }))

    const hasTemplate = section.template
    const newStatus = hasTemplate && users.length > 0 ? 'ready' : hasTemplate ? 'template-configured' : 'users-loaded'

    updateSection({
      id: section.id,
      updates: {
        users,
        status: newStatus
      }
    })
    
    setCsvData(null)
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

  if (!section.template) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="text-center py-8">
          <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Template Required</h3>
          <p className="text-gray-600">
            Please upload and configure a PDF template first before setting up data mapping.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">CSV Data Configuration</h2>
        
        {!csvData ? (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragActive ? 'Drop your CSV here' : 'Upload CSV Data'}
              </p>
              <p className="text-gray-600 mb-4">
                Upload a CSV file with user data to map to your PDF template fields
              </p>
              <Button variant="outline" disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Choose File'}
              </Button>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800">{error}</p>
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
          </div>
        )}
      </div>

      {csvData && (
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
                          <Badge variant="destructive\" className="ml-2 text-xs">
                            Required
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{field.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping?.csvColumnName || ''}
                          onValueChange={(value) => handleMappingChange(field.name, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select CSV column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No mapping</SelectItem>
                            {csvData.headers.map((header) => (
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

          <div className="flex justify-end mt-6">
            <Button 
              onClick={importUsers}
              disabled={mappingStatus && mappingStatus.requiredMapped < mappingStatus.required}
              className="flex items-center gap-2"
            >
              Import Users
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}