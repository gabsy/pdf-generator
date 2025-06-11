import React, { useState } from 'react'
import { Button } from '../ui/button'
import { AlertCircle, FileText, Loader2 } from 'lucide-react'
import { extractXFAFormFields, isPDFUsingXFA } from '../../utils/pdfUtils'
import { PDFGenerationService } from '../../services/pdfGeneration'

interface PDFFieldExtractorProps {
  onFieldsExtracted: (fields: any[]) => void
  onError: (error: string) => void
}

export function PDFFieldExtractor({ onFieldsExtracted, onError }: PDFFieldExtractorProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [debugInfo, setDebugInfo] = useState<string>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const extractFields = async () => {
    if (!file) {
      onError('Please select a PDF file first')
      return
    }

    setIsProcessing(true)
    setProgress('Reading file...')
    setDebugInfo(`File: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

    try {
      // Read the file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()
      
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Failed to read file content. Please try again.')
      }

      setProgress('Checking PDF format...')
      setDebugInfo(prev => `${prev}\nBuffer size: ${arrayBuffer.byteLength} bytes`)
      
      // Check if the PDF is using XFA
      const isXFA = await isPDFUsingXFA(arrayBuffer)
      
      setProgress(`Detected ${isXFA ? 'XFA' : 'standard'} PDF format. Extracting fields...`)
      setDebugInfo(prev => `${prev}\nPDF format: ${isXFA ? 'XFA' : 'standard'}`)
      
      let extractedFields = []
      
      // Try standard extraction first
      try {
        const pdfService = new PDFGenerationService()
        const { fields } = await pdfService.extractFormFields(arrayBuffer)
        extractedFields = fields
        
        setProgress(`Found ${extractedFields.length} fields using standard method`)
        setDebugInfo(prev => `${prev}\nStandard extraction: ${extractedFields.length} fields`)
      } catch (standardError) {
        console.error('Standard field extraction failed:', standardError)
        setProgress('Standard extraction failed, trying alternative method...')
        setDebugInfo(prev => `${prev}\nStandard extraction failed: ${standardError}`)
      }
      
      // If standard extraction didn't find fields and it's an XFA form, try XFA extraction
      if (extractedFields.length === 0 && isXFA) {
        setProgress('Attempting XFA field extraction...')
        const fieldNames = await extractXFAFormFields(arrayBuffer)
        
        extractedFields = fieldNames.map(name => ({
          name,
          type: 'text', // Default to text since we can't determine type
          required: false
        }))
        
        setProgress(`Found ${extractedFields.length} fields using XFA extraction`)
        setDebugInfo(prev => `${prev}\nXFA extraction: ${extractedFields.length} fields`)
      }
      
      // If we still don't have fields, try one more approach
      if (extractedFields.length === 0) {
        setProgress('Attempting deep extraction...')
        
        // Convert ArrayBuffer to string to search for field patterns
        const bytes = new Uint8Array(arrayBuffer)
        let pdfText = ''
        for (let i = 0; i < Math.min(bytes.byteLength, 5000000); i++) { // Limit to first 5MB
          pdfText += String.fromCharCode(bytes[i])
        }
        
        // Look for common field patterns in the PDF
        const fieldPatterns = [
          /\/T\s*\(([^)]+)\)/g,  // AcroForm fields
          /<field\s+name="([^"]+)"/gi,  // XFA fields
          /TU\s*\(([^)]+)\)/g,  // Tool tip (often contains field names)
          /\/V\s*\(([^)]+)\)/g,  // Field values (might indicate field names)
          /\/Ff\s+(\d+)/g,       // Field flags (indicates field presence)
          /\/FT\s+\/([A-Za-z]+)/g, // Field types
          /\/Kids\s*\[/g,        // Field with kids (indicates field presence)
          /\/Subtype\s*\/Widget/g // Widget annotations (often form fields)
        ]
        
        const foundFields = new Set<string>()
        let hasFormElements = false
        
        for (const pattern of fieldPatterns) {
          let match
          let count = 0
          pattern.lastIndex = 0 // Reset regex state
          
          while ((match = pattern.exec(pdfText)) !== null) {
            count++
            if (match[1]) {
              // Skip some common non-field names
              const fieldName = match[1]
              if (!fieldName.includes(' ') && 
                  !['form', 'data', 'template', 'subform', 'exData', 'bind'].includes(fieldName.toLowerCase())) {
                foundFields.add(fieldName)
              }
            } else {
              // If we found form elements but no names, mark that we have form elements
              hasFormElements = true
            }
          }
          
          setDebugInfo(prev => `${prev}\nPattern ${pattern.source}: ${count} matches`)
        }
        
        // If we found field names, use them
        if (foundFields.size > 0) {
          extractedFields = Array.from(foundFields).map(name => ({
            name,
            type: 'text',
            required: false
          }))
          
          setProgress(`Found ${extractedFields.length} fields using deep extraction`)
          setDebugInfo(prev => `${prev}\nDeep extraction: ${extractedFields.length} fields`)
        }
        // If we found form elements but no names, create generic field names
        else if (hasFormElements) {
          setProgress('Form elements detected, but field names could not be extracted')
          setDebugInfo(prev => `${prev}\nForm elements detected, creating generic fields`)
          
          // Create 10 generic fields as placeholders
          extractedFields = Array.from({ length: 10 }, (_, i) => ({
            name: `field_${i + 1}`,
            type: 'text',
            required: false
          }))
        }
      }
      
      // If we still don't have fields, create some generic ones
      if (extractedFields.length === 0) {
        setProgress('No fields detected, creating generic fields')
        setDebugInfo(prev => `${prev}\nNo fields detected, creating generic fields`)
        
        // Create generic fields for each page
        const pdfService = new PDFGenerationService()
        const { pageCount } = await pdfService.extractFormFields(arrayBuffer)
        
        extractedFields = Array.from({ length: Math.max(5, pageCount * 2) }, (_, i) => ({
          name: `field_${i + 1}`,
          type: 'text',
          required: false
        }))
      }
      
      // Success - pass the extracted fields to the parent component
      onFieldsExtracted(extractedFields)
      
    } catch (error) {
      console.error('Error extracting fields:', error)
      onError(error instanceof Error ? error.message : 'Failed to extract fields')
      setDebugInfo(prev => `${prev}\nError: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label 
            htmlFor="pdf-upload" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Select PDF File
          </label>
          <div className="flex">
            <input
              id="pdf-upload"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>
        </div>
        <Button
          onClick={extractFields}
          disabled={!file || isProcessing}
          className="mt-6"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            'Extract Fields'
          )}
        </Button>
      </div>
      
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-2" />
            <p className="text-blue-800">{progress}</p>
          </div>
          {debugInfo && (
            <details className="mt-2">
              <summary className="text-xs text-blue-600 cursor-pointer">Debug Information</summary>
              <pre className="text-xs text-blue-600 mt-1 whitespace-pre-wrap bg-blue-100 p-2 rounded">
                {debugInfo}
              </pre>
            </details>
          )}
        </div>
      )}
      
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-gray-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-gray-900 mb-1">About PDF Field Extraction</h4>
            <p className="text-sm text-gray-700 mb-2">
              This tool attempts to extract form fields from your PDF document. It supports both standard PDF forms and XFA (XML Forms Architecture) forms.
            </p>
            <p className="text-xs text-gray-600">
              Note: Some complex or secured PDFs may not reveal all their fields through automatic extraction. In such cases, you can manually add fields in the Field Editor tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}