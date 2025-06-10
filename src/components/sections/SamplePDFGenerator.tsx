import React, { useState } from 'react'
import { Button } from '../ui/button'
import { Download, FileText, Loader2 } from 'lucide-react'
import { createSamplePDFTemplate } from '../../utils/createSamplePDF'

export function SamplePDFGenerator() {
  const [isGenerating, setIsGenerating] = useState(false)

  const generateSamplePDF = async () => {
    setIsGenerating(true)
    try {
      const pdfBytes = await createSamplePDFTemplate()
      
      // Create download
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sample_employee_form_template.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error generating sample PDF:', error)
      alert('Failed to generate sample PDF. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-blue-900 mb-2">Need a Sample Template?</h4>
          <p className="text-sm text-blue-800 mb-3">
            Download a sample PDF template with various form field types to test the application.
            This template includes text fields, dropdowns, checkboxes, and more.
          </p>
          <Button
            onClick={generateSamplePDF}
            disabled={isGenerating}
            size="sm"
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isGenerating ? 'Generating...' : 'Download Sample Template'}
          </Button>
        </div>
      </div>
    </div>
  )
}