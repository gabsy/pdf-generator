import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { PDFFieldExtractor } from './PDFFieldExtractor'
import { PDFField, Section } from '../../types'
import { useSections } from '../../hooks/useSections'
import { AlertCircle, Settings, FileText } from 'lucide-react'

interface AdvancedTemplateOptionsProps {
  section: Section
}

export function AdvancedTemplateOptions({ section }: AdvancedTemplateOptionsProps) {
  const { updateSection } = useSections()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
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
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">Current Template Fields</h4>
                  <p className="text-sm text-blue-800 mb-3">
                    Your template has {section.template.extractedFields.length} detected fields.
                    If fields are missing, try using the Field Extractor tab first.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Open a dialog to edit fields (implementation would be added later)
                      alert('Field editor will be implemented in a future update.')
                    }}
                  >
                    Edit Fields Manually
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}