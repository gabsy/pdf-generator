import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Download, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import { Section, PDFField } from '../../types'
import { useSections } from '../../hooks/useSections'
import { SamplePDFGenerator } from './SamplePDFGenerator'
import { PDFDocument } from 'pdf-lib'

interface TemplateConfigurationProps {
  section: Section
}

export function TemplateConfiguration({ section }: TemplateConfigurationProps) {
  const { updateSection, isUpdating } = useSections()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [debugInfo, setDebugInfo] = useState<string>('')

  const processTemplate = async (file: File) => {
    console.log('Starting PDF processing...', { fileName: file.name, fileSize: file.size, fileType: file.type })
    
    setIsProcessing(true)
    setError(null)
    setUploadProgress('Reading file...')
    setDebugInfo(`File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    try {
      // Validate file type
      if (file.type !== 'application/pdf') {
        throw new Error(`Invalid file type: ${file.type}. Please upload a PDF file.`)
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)} MB. Maximum size is 10MB.`)
      }

      if (file.size === 0) {
        throw new Error('File appears to be empty. Please try uploading again.')
      }

      setUploadProgress('Converting file to buffer...')
      
      const arrayBuffer = await file.arrayBuffer()
      console.log('ArrayBuffer created:', { byteLength: arrayBuffer.byteLength })
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Failed to read file content. Please try again.')
      }

      setUploadProgress('Loading PDF document...')
      setDebugInfo(prev => prev + `\nBuffer size: ${arrayBuffer.byteLength} bytes`)
      
      let pdfDoc: PDFDocument
      try {
        pdfDoc = await PDFDocument.load(arrayBuffer)
        console.log('PDF loaded successfully')
      } catch (pdfError) {
        console.error('PDF loading error:', pdfError)
        throw new Error(`Invalid PDF file: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`)
      }
      
      setUploadProgress('Extracting form fields...')
      
      // Get page count
      const pageCount = pdfDoc.getPageCount()
      console.log('PDF page count:', pageCount)
      setDebugInfo(prev => prev + `\nPages: ${pageCount}`)
      
      // Extract form fields
      let form: any
      let fields: any[] = []
      
      try {
        form = pdfDoc.getForm()
        fields = form.getFields()
        console.log('Form fields found:', fields.length)
        setDebugInfo(prev => prev + `\nForm fields: ${fields.length}`)
      } catch (formError) {
        console.warn('No form found or error extracting form:', formError)
        // Continue without form fields - this is not necessarily an error
      }
      
      const extractedFields: PDFField[] = fields.map((field, index) => {
        try {
          const fieldName = field.getName()
          const fieldType = field.constructor.name
          
          console.log(`Field ${index}:`, { name: fieldName, type: fieldType })
          
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
              console.warn('Could not extract radio options:', e)
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
              console.warn('Could not extract dropdown options:', e)
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
        } catch (fieldError) {
          console.error(`Error processing field ${index}:`, fieldError)
          return {
            name: `field_${index}`,
            type: 'text' as const,
            required: false
          }
        }
      })

      setUploadProgress('Saving template...')

      const template = {
        fileName: file.name,
        fileData: arrayBuffer,
        extractedFields,
        uploadedAt: new Date(),
        pageCount
      }

      console.log('Calling updateSection with template:', {
        fileName: template.fileName,
        pageCount: template.pageCount,
        fieldsCount: template.extractedFields.length
      })

      // Use a promise to handle the mutation
      await new Promise<void>((resolve, reject) => {
        updateSection(
          { 
            id: section.id, 
            updates: { 
              template,
              // Reset field mappings when replacing template to avoid conflicts
              fieldMappings: [],
              status: section.users.length > 0 ? 'ready' : 'template-configured'
            }
          },
          {
            onSuccess: () => {
              console.log('Template updated successfully')
              setUploadProgress('Complete!')
              setDebugInfo(prev => prev + '\nUpload successful!')
              
              // Clear progress after a short delay
              setTimeout(() => {
                setUploadProgress('')
                setDebugInfo('')
              }, 2000)
              
              resolve()
            },
            onError: (updateError: any) => {
              console.error('Error updating section:', updateError)
              reject(new Error(`Failed to save template: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`))
            }
          }
        )
      })

    } catch (err) {
      console.error('Error processing PDF:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to process PDF'
      setError(errorMessage)
      setDebugInfo(prev => prev + `\nError: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    console.log('Files dropped:', { accepted: acceptedFiles.length, rejected: rejectedFiles.length })
    
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      console.log('File rejected:', rejection)
      
      if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setError('Please upload a PDF file only')
      } else if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setError('File size must be less than 10MB')
      } else {
        setError(`File rejected: ${rejection.errors.map((e: any) => e.message).join(', ')}`)
      }
      return
    }

    const file = acceptedFiles[0]
    if (file) {
      console.log('Processing file:', file)
      setError(null)
      setDebugInfo('')
      processTemplate(file)
    } else {
      console.log('No file to process')
      setError('No file selected')
    }
  }, [section.id, section.users.length, updateSection])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: isProcessing || isUpdating,
    onDropRejected: (rejectedFiles) => {
      console.log('Drop rejected:', rejectedFiles)
    },
    onDropAccepted: (acceptedFiles) => {
      console.log('Drop accepted:', acceptedFiles)
    }
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
    if (confirm('Are you sure you want to remove this template? This will also clear any field mappings and reset users data.')) {
      console.log('Removing template for section:', section.id)
      
      // Use a promise to handle the mutation and ensure UI updates
      const promise = new Promise<void>((resolve, reject) => {
        updateSection(
          {
            id: section.id,
            updates: {
              template: null, // Explicitly set to null to trigger removal
              fieldMappings: [],
              users: [], // Also clear users when removing template
              status: 'draft'
            }
          },
          {
            onSuccess: () => {
              console.log('Template removed successfully')
              // Clear any local state
              setError(null)
              setUploadProgress('')
              setDebugInfo('')
              resolve()
            },
            onError: (error: any) => {
              console.error('Error removing template:', error)
              setError(`Failed to remove template: ${error.message}`)
              reject(error)
            }
          }
        )
      })

      // Handle the promise to show any errors
      promise.catch((error) => {
        console.error('Template removal failed:', error)
      })
    }
  }

  const replaceTemplate = () => {
    // Clear any existing errors and trigger file selection
    setError(null)
    setUploadProgress('')
    setDebugInfo('')
    
    // Create a hidden file input and trigger it
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.pdf'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        processTemplate(file)
      }
    }
    input.click()
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
    
    if (isProcessing || isUpdating) {
      return `${baseStyles} border-gray-300 bg-gray-50 cursor-not-allowed`
    } else if (isDragReject) {
      return `${baseStyles} border-red-400 bg-red-50`
    } else if (isDragActive) {
      return `${baseStyles} border-blue-400 bg-blue-50`
    } else {
      return `${baseStyles} border-gray-300 hover:border-gray-400`
    }
  }

  const isDisabled = isProcessing || isUpdating

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">PDF Template Configuration</h2>
        
        {!section.template ? (
          <div className="space-y-4">
            {/* Sample PDF Generator */}
            <SamplePDFGenerator />
            
            <div
              {...getRootProps()}
              className={getDropzoneStyles()}
            >
              <input {...getInputProps()} />
              {isProcessing || isUpdating ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    {isProcessing ? 'Processing PDF...' : 'Saving template...'}
                  </p>
                  {uploadProgress && (
                    <p className="text-sm text-gray-600 mb-2">{uploadProgress}</p>
                  )}
                  {debugInfo && (
                    <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded max-w-md">
                      <pre className="whitespace-pre-wrap">{debugInfo}</pre>
                    </div>
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
                  <Button variant="outline" disabled={isDisabled}>
                    Choose PDF File
                  </Button>
                </>
              )}
            </div>
            
            {error && (
              <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium">Upload Error</p>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                  {debugInfo && (
                    <details className="mt-2">
                      <summary className="text-xs text-red-600 cursor-pointer">Debug Information</summary>
                      <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap bg-red-100 p-2 rounded">
                        {debugInfo}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Requirements:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• PDF must be a valid, non-corrupted file</li>
                <li>• Fillable form fields are recommended but not required</li>
                <li>• Supported field types: text, checkbox, radio buttons, dropdowns</li>
                <li>• File size must be under 10MB</li>
                <li>• Form fields will be automatically detected if present</li>
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
                  disabled={isUpdating}
                >
                  <Download className="h-4 w-4" />
                  Download CSV Template
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={replaceTemplate}
                  className="text-blue-600 hover:text-blue-700"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Updating...' : 'Replace Template'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={removeTemplate}
                  className="text-red-600 hover:text-red-700"
                  disabled={isUpdating}
                >
                  Remove Template
                </Button>
              </div>
            </div>

            {/* Show processing state when updating */}
            {isUpdating && (
              <div className="flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-2" />
                <p className="text-blue-800">Updating template...</p>
              </div>
            )}
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