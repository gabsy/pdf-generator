import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Download, AlertCircle, CheckCircle } from 'lucide-react'
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

  const processTemplate = async (file: File) => {
    setIsProcessing(true)
    setError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      
      // Extract form fields
      const form = pdfDoc.getForm()
      const fields = form.getFields()
      
      const extractedFields: PDFField[] = fields.map(field => {
        const fieldName = field.getName()
        const fieldType = field.constructor.name
        
        let type: PDFField['type'] = 'text'
        let options: string[] | undefined = undefined
        
        if (fieldType.includes('Checkbox')) {
          type = 'checkbox'
        } else if (fieldType.includes('Radio')) {
          type = 'radio'
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
        }
        
        return {
          name: fieldName,
          type,
          required: false, // We'll assume all fields are optional by default
          options
        }
      })

      const template = {
        fileName: file.name,
        fileData: arrayBuffer,
        extractedFields,
        uploadedAt: new Date(),
        pageCount: pdfDoc.getPageCount()
      }

      updateSection({ 
        id: section.id, 
        updates: { 
          template,
          status: 'template-configured'
        }
      })
    } catch (err) {
      console.error('Error processing PDF:', err)
      setError('Failed to process PDF. Please ensure it\'s a valid PDF with form fields.')
    } finally {
      setIsProcessing(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      processTemplate(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  })

  const generateSampleCSV = () => {
    if (!section.template) return

    const headers = section.template.extractedFields.map(field => field.name)
    const csvContent = headers.join(',') + '\n' + headers.map(() => 'sample_value').join(',')
    
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
    updateSection({
      id: section.id,
      updates: {
        template: undefined,
        fieldMappings: [],
        status: 'draft'
      }
    })
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <h2 className="text-xl font-semibold mb-4">PDF Template Configuration</h2>
        
        {!section.template ? (
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
                {isDragActive ? 'Drop your PDF here' : 'Upload PDF Template'}
              </p>
              <p className="text-gray-600 mb-4">
                Drag and drop your PDF template with form fields, or click to browse
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
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">{section.template.fileName}</p>
                  <p className="text-sm text-green-700">
                    {section.template.pageCount} pages • {section.template.extractedFields.length} fields
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
          <h3 className="text-lg font-semibold mb-4">Extracted Form Fields</h3>
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
                          {field.options.join(', ')}
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
        </div>
      )}
    </div>
  )
}