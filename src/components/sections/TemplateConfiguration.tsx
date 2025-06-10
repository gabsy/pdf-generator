import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Section, PDFField } from '../../types'
import { useSections } from '../../hooks/useSections'
import { PDFDocument } from 'pdf-lib'

interface TemplateConfigurationProps {
  section: Section
}

export function TemplateConfiguration({ section }: TemplateConfigurationProps) {
  const { updateSection } = useSections()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>('')

  const processTemplate = async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setUploadProgress('Reading file...')

    try {
      // Validate file type
      if (file.type !== 'application/pdf') {
        throw new Error('Please upload a valid PDF file')
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File size must be less than 10MB')
      }

      setUploadProgress('Processing PDF...')
      
      const arrayBuffer = await file.arrayBuffer()
      
      setUploadProgress('Extracting form fields...')
      
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      
      // Extract form fields
      const form = pdfDoc.getForm()
      const fields = form.getFields()
      
      if (fields.length === 0) {
        console.warn('No form fields found in PDF')
      }
      
      const extractedFields: PDFField[] = fields.map(field => {
        const fieldName = field.getName()
        const fieldType = field.constructor.name
        
        let type: PDFField['type'] = 'text'
        let options: string[] | undefined = undefined
        
        if (fieldType.includes('Checkbox')) {
          type = 'checkbox'
        } else if (fieldType.includes('Radio')) {
          type = 'radio'
          // Try to get radio button options
          try {
            const radioField = field as any
            if (radioField.getOptions) {
              options = radioField.getOptions()
            }
          } catch (e) {
            // Ignore if options can't be extracted
          }
        } else if (fieldType.includes('Dropdown')) {
          type = 'dropdown'
          // Extract options from dropdown if available
          try {
            const dropdown = field as any
            if (dropdown.getOptions) {
              options = dropdown.getOptions()
            }
          } catch (e) {
            // Ignore if options can't be extracted
          }
        } else if (fieldType.includes('Text')) {
          type = 'text'
        }
        
        return {
          name: fieldName,
          type,
          required: false, // We'll assume all fields are optional by default
          options
        }
      })

      setUploadProgress('Saving template...')

      const template = {
        fileName: file.name,
        fileData: arrayBuffer,
        extractedFields,
        uploadedAt: new Date(),
        pageCount: pdfDoc.getPageCount()
      }

      await updateSection({ 
        id: section.id, 
        updates: { 
          template,
          status: section.users.length > 0 ? 'ready' : 'template-configured'
        }
      })

      setUploadProgress('Complete!')
      
      // Clear progress after a short delay
      setTimeout(() => {
        setUploadProgress('')
      }, 1000)

    } catch (err) {
      console.error('Error processing PDF:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to process PDF'
      setError(`${errorMessage}. Please ensure it's a valid PDF file.`)
    } finally {
      setIsProcessing(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setError('Please upload a PDF file only')
      } else if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setError('File size must be less than 10MB')
      } else {
        setError('Invalid file. Please try again.')
      }
      return
    }

    const file = acceptedFiles[0]
    if (file) {
      setError(null)
      processTemplate(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false
  })

  const generateSampleCSV = () => {
    if (!section.template) return

    const headers = section.template.extractedFields.map(field => field.name)
    const sampleRow = section.template.extractedFields.map(field => {
      switch (field.type) {
        case 'checkbox':
          return 'true'
        case 'dropdown':
        case 'radio':
          return field.options?.[0] || 'option1'
        default:
          return 'sample_value'
      }
    })
    
    const csvContent = headers.join(',') + '\n' + sampleRow.join(',')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${section.name}_template.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const removeTemplate = () => {
    if (confirm('Are you sure you want to remove this template? This will also clear any field mappings.')) {
      updateSection({
        id: section.id,
        updates: {
          template: undefined,
          fieldMappings: [],
          status: section.users.length > 0 ? 'users-loaded' : 'draft'
        }
      })
    }
  }

  const getFieldTypeColor = (type: string) => {
    switch (type) {
      case 'text':
        return 'default'
      case 'checkbox':
        return 'secondary'
      case 'radio':
        return 'secondary'
      case 'dropdown':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getDropzoneStyles = () => {
    let baseStyles = "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors"
    
    if (isDragReject) {
      return `${baseStyles} border-red-400 bg-red-50`
    } else if (isDragActive) {
      return `${baseStyles} border-blue-400 bg-blue-50`
    } else {
      return `${baseStyles} border-gray-300 hover:border-gray-400`
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">PDF Template Configuration</h2>
        
        {!section.template ? (
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={getDropzoneStyles()}
            >
              <input {...getInputProps()} />
              {isProcessing ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">Processing PDF...</p>
                  {uploadProgress && (
                    <p className="text-sm text-gray-600">{uploadProgress}</p>
                  )}
                </div>
              ) : (
                <>
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    {isDragReject 
                      ? 'Invalid file type' 
                      : isDragActive 
                        ? 'Drop your PDF here' 
                        : 'Upload PDF Template'
                    }
                  </p>
                  <p className="text-gray-600 mb-4">
                    {isDragReject 
                      ? 'Please upload a PDF file only'
                      : 'Drag and drop your PDF template with form fields, or click to browse'
                    }
                  </p>
                  <p className="text-sm text-gray-500 mb-4">
                    Maximum file size: 10MB
                  </p>
                  <Button variant="outline" disabled={isProcessing}>
                    Choose PDF File
                  </Button>
                </>
              )}
            </div>
            
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Requirements:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• PDF must contain fillable form fields</li>
                <li>• Supported field types: text, checkbox, radio buttons, dropdowns</li>
                <li>• File size must be under 10MB</li>
                <li>• Form fields will be automatically detected</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{section.template.fileName}</p>
                  <p className="text-sm text-green-700">
                    {section.template.pageCount} pages • {section.template.extractedFields.length} fields detected
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateSampleCSV}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download CSV Template
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeTemplate}
                  className="text-red-600 hover:text-red-700"
                >
                  Replace Template
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {section.template && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Detected Form Fields</h3>
          {section.template.extractedFields.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No Form Fields Detected</h4>
              <p className="text-gray-600 mb-4">
                This PDF doesn't appear to have fillable form fields. You can still use it, but you'll need to manually map data to field positions.
              </p>
              <p className="text-sm text-gray-500">
                To create fillable forms, use Adobe Acrobat or similar PDF editing software.
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-4">
                These fields were automatically detected in your PDF template. Use the "Download CSV Template" button above to get a sample CSV file with the correct headers.
              </p>
              
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Options</TableHead>
                      <TableHead>Required</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.template.extractedFields.map((field, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{field.name}</TableCell>
                        <TableCell>
                          <Badge variant={getFieldTypeColor(field.type)}>
                            {field.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {field.options && field.options.length > 0 ? (
                            <span className="text-sm text-gray-600">
                              {field.options.slice(0, 3).join(', ')}
                              {field.options.length > 3 && ` +${field.options.length - 3} more`}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={field.required ? 'destructive' : 'outline'}>
                            {field.required ? 'Required' : 'Optional'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}