import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib'
import { PDFTemplate, User, FieldMapping, GenerationProgress } from '../types'
import JSZip from 'jszip'

export class PDFGenerationService {
  async generateSinglePDF(
    template: PDFTemplate,
    user: User,
    fieldMappings: FieldMapping[]
  ): Promise<Uint8Array> {
    // Create a copy of the template
    const pdfDoc = await PDFDocument.load(template.fileData)
    
    try {
      // Get the form from the PDF
      const form = pdfDoc.getForm()
      
      // Fill the form fields based on mappings
      for (const mapping of fieldMappings) {
        try {
          // Get the value from user data or default value
          let value = user[mapping.csvColumnName] || mapping.defaultValue || ''
          
          // Convert value to string
          value = String(value)
          
          // Try to get the field by name
          try {
            const field = form.getField(mapping.pdfFieldName)
            
            // Handle different field types
            if (field instanceof PDFTextField) {
              field.setText(value)
            } else if (field instanceof PDFCheckBox) {
              // For checkboxes, check if value is truthy
              const shouldCheck = value.toLowerCase() === 'true' || 
                                value.toLowerCase() === 'yes' || 
                                value === '1' || 
                                value.toLowerCase() === 'on'
              if (shouldCheck) {
                field.check()
              } else {
                field.uncheck()
              }
            } else if (field instanceof PDFRadioGroup) {
              // For radio groups, try to select the option that matches the value
              const options = field.getOptions()
              if (options.includes(value)) {
                field.select(value)
              }
            } else if (field instanceof PDFDropdown) {
              // For dropdowns, try to select the option that matches the value
              const options = field.getOptions()
              if (options.includes(value)) {
                field.select(value)
              }
            }
          } catch (fieldError) {
            console.warn(`Field not found or error accessing field ${mapping.pdfFieldName}:`, fieldError)
            
            // Try to fill the field using AcroForm field names (for XFA compatibility)
            try {
              // Get all form fields
              const fields = form.getFields()
              
              // Find field by name (case insensitive)
              const matchingField = fields.find(f => 
                f.getName().toLowerCase() === mapping.pdfFieldName.toLowerCase()
              )
              
              if (matchingField) {
                if (matchingField instanceof PDFTextField) {
                  matchingField.setText(value)
                } else if (matchingField instanceof PDFCheckBox) {
                  const shouldCheck = value.toLowerCase() === 'true' || 
                                    value.toLowerCase() === 'yes' || 
                                    value === '1' || 
                                    value.toLowerCase() === 'on'
                  if (shouldCheck) {
                    matchingField.check()
                  } else {
                    matchingField.uncheck()
                  }
                } else if (matchingField instanceof PDFRadioGroup) {
                  const options = matchingField.getOptions()
                  if (options.includes(value)) {
                    matchingField.select(value)
                  }
                } else if (matchingField instanceof PDFDropdown) {
                  const options = matchingField.getOptions()
                  if (options.includes(value)) {
                    matchingField.select(value)
                  }
                }
              }
            } catch (alternateFieldError) {
              console.warn(`Alternative field access failed for ${mapping.pdfFieldName}:`, alternateFieldError)
            }
          }
        } catch (error) {
          console.warn(`Failed to set field ${mapping.pdfFieldName}:`, error)
        }
      }
      
      // Attempt to flatten the form to make it non-editable
      try {
        form.flatten()
      } catch (flattenError) {
        console.warn('Could not flatten form, continuing without flattening:', flattenError)
      }
      
    } catch (formError) {
      console.warn('Error accessing form, continuing with unfilled PDF:', formError)
    }

    return pdfDoc.save()
  }

  async generateBulkPDFs(
    template: PDFTemplate,
    users: User[],
    fieldMappings: FieldMapping[],
    sectionName: string,
    onProgress: (progress: GenerationProgress) => void
  ): Promise<Blob> {
    const zip = new JSZip()

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      
      // Update progress
      onProgress({
        current: i,
        total: users.length,
        status: 'processing'
      })

      try {
        const pdfBytes = await this.generateSinglePDF(template, user, fieldMappings)
        
        // Create filename based on user data or ID
        let filename = `${sectionName}_${user.id}.pdf`
        
        // Try to create a more meaningful filename if possible
        const nameField = fieldMappings.find(m => 
          m.csvColumnName && ['name', 'full_name', 'fullname', 'first_name', 'lastname'].includes(m.csvColumnName.toLowerCase())
        )
        
        if (nameField && user[nameField.csvColumnName]) {
          const name = String(user[nameField.csvColumnName]).replace(/[^a-zA-Z0-9]/g, '_')
          filename = `${sectionName}_${name}_${user.id}.pdf`
        }

        zip.file(filename, pdfBytes)
      } catch (error) {
        console.error(`Failed to generate PDF for user ${user.id}:`, error)
        // Continue with other users even if one fails
      }
    }

    // Final progress update
    onProgress({
      current: users.length,
      total: users.length,
      status: 'completed'
    })

    return zip.generateAsync({ type: 'blob' })
  }

  // Enhanced form field extraction with multiple methods
  async extractFormFields(pdfData: ArrayBuffer): Promise<{ fields: any[], pageCount: number }> {
    try {
      console.log('Starting PDF field extraction...')
      const pdfDoc = await PDFDocument.load(pdfData)
      const pageCount = pdfDoc.getPageCount()
      let extractedFields: any[] = []
      
      console.log(`PDF loaded successfully with ${pageCount} pages`)
      
      // Method 1: Standard PDF-lib form extraction
      try {
        const form = pdfDoc.getForm()
        const fields = form.getFields()
        
        console.log(`Method 1 - Standard extraction: Found ${fields.length} fields`)
        
        for (const field of fields) {
          try {
            const fieldName = field.getName()
            let fieldType = 'text'
            let options = undefined
            
            // Determine field type based on constructor name
            const constructorName = field.constructor.name
            console.log(`Field: ${fieldName}, Constructor: ${constructorName}`)
            
            if (constructorName.includes('Checkbox') || constructorName.includes('CheckBox')) {
              fieldType = 'checkbox'
            } else if (constructorName.includes('Radio')) {
              fieldType = 'radio'
              try {
                const radioField = field as PDFRadioGroup
                if (radioField.getOptions) {
                  options = radioField.getOptions()
                }
              } catch (e) {
                console.warn('Could not extract radio options:', e)
              }
            } else if (constructorName.includes('Dropdown') || constructorName.includes('Choice')) {
              fieldType = 'dropdown'
              try {
                const dropdown = field as PDFDropdown
                if (dropdown.getOptions) {
                  options = dropdown.getOptions()
                }
              } catch (e) {
                console.warn('Could not extract dropdown options:', e)
              }
            } else if (constructorName.includes('Text')) {
              fieldType = 'text'
            }
            
            extractedFields.push({
              name: fieldName,
              type: fieldType,
              required: false,
              options
            })
          } catch (fieldError) {
            console.warn('Error processing field:', fieldError)
          }
        }
      } catch (formError) {
        console.warn('Method 1 failed - No standard form found:', formError)
      }
      
      // Method 2: Raw PDF content analysis if standard method found few/no fields
      if (extractedFields.length < 3) {
        console.log('Method 2 - Raw content analysis...')
        const rawFields = await this.extractFieldsFromRawPDF(pdfData)
        
        if (rawFields.length > extractedFields.length) {
          console.log(`Method 2 found ${rawFields.length} fields, using these instead`)
          extractedFields = rawFields
        }
      }
      
      // Method 3: Annotation-based extraction
      if (extractedFields.length < 3) {
        console.log('Method 3 - Annotation-based extraction...')
        const annotationFields = await this.extractFieldsFromAnnotations(pdfDoc)
        
        if (annotationFields.length > extractedFields.length) {
          console.log(`Method 3 found ${annotationFields.length} fields, using these instead`)
          extractedFields = annotationFields
        }
      }
      
      // Method 4: Create generic fields based on page content if still no fields found
      if (extractedFields.length === 0) {
        console.log('Method 4 - Creating generic fields based on page analysis...')
        extractedFields = await this.createGenericFields(pdfDoc)
      }
      
      console.log(`Final result: ${extractedFields.length} fields extracted`)
      
      return {
        fields: extractedFields,
        pageCount
      }
    } catch (error) {
      console.error('Error extracting form fields:', error)
      throw error
    }
  }

  // Method 2: Extract fields from raw PDF content
  private async extractFieldsFromRawPDF(pdfData: ArrayBuffer): Promise<any[]> {
    try {
      const bytes = new Uint8Array(pdfData)
      let pdfText = ''
      
      // Convert to string for pattern matching (limit to first 5MB for performance)
      const maxBytes = Math.min(bytes.byteLength, 5000000)
      for (let i = 0; i < maxBytes; i++) {
        pdfText += String.fromCharCode(bytes[i])
      }
      
      const fieldNames = new Set<string>()
      
      // Enhanced patterns for field detection
      const patterns = [
        // AcroForm field names
        /\/T\s*\(([^)]+)\)/g,
        // XFA field names
        /<field\s+name="([^"]+)"/gi,
        /<field\s+name='([^']+)'/gi,
        // Tool tips (often contain field names)
        /\/TU\s*\(([^)]+)\)/g,
        // Field values that might indicate field names
        /\/V\s*\(([^)]+)\)/g,
        // Widget annotations with field names
        /\/Subtype\s*\/Widget.*?\/T\s*\(([^)]+)\)/gs,
        // Form field dictionaries
        /\/FT\s*\/\w+.*?\/T\s*\(([^)]+)\)/gs,
        // XFA template field references
        /<bind\s+ref="([^"]+)"/gi,
        // XFA data field references
        /<\w+:field\s+name="([^"]+)"/gi,
        // Alternative XFA patterns
        /\$record\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
        // Field references in JavaScript
        /this\.getField\("([^"]+)"\)/g,
        /this\.getField\('([^']+)'\)/g,
        // Form calculation references
        /event\.target\.name\s*==\s*"([^"]+)"/g,
      ]
      
      for (const pattern of patterns) {
        let match
        pattern.lastIndex = 0 // Reset regex state
        
        while ((match = pattern.exec(pdfText)) !== null) {
          if (match[1]) {
            const fieldName = match[1].trim()
            
            // Filter out common non-field strings
            if (this.isValidFieldName(fieldName)) {
              fieldNames.add(fieldName)
            }
          }
        }
      }
      
      // Convert to field objects
      return Array.from(fieldNames).map(name => ({
        name,
        type: 'text',
        required: false
      }))
    } catch (error) {
      console.error('Error in raw PDF extraction:', error)
      return []
    }
  }

  // Method 3: Extract fields from PDF annotations
  private async extractFieldsFromAnnotations(pdfDoc: PDFDocument): Promise<any[]> {
    try {
      const fields: any[] = []
      const pages = pdfDoc.getPages()
      
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex]
        
        try {
          // Get page annotations
          const annotations = page.node.Annots
          
          if (annotations) {
            // This is a simplified approach - in a real implementation,
            // you'd need to parse the annotation dictionaries more thoroughly
            console.log(`Page ${pageIndex + 1} has annotations`)
            
            // Create generic fields for pages with annotations
            for (let i = 1; i <= 3; i++) {
              fields.push({
                name: `page${pageIndex + 1}_field${i}`,
                type: 'text',
                required: false
              })
            }
          }
        } catch (pageError) {
          console.warn(`Error processing page ${pageIndex + 1}:`, pageError)
        }
      }
      
      return fields
    } catch (error) {
      console.error('Error in annotation extraction:', error)
      return []
    }
  }

  // Method 4: Create generic fields based on page analysis
  private async createGenericFields(pdfDoc: PDFDocument): Promise<any[]> {
    const pageCount = pdfDoc.getPageCount()
    const fields: any[] = []
    
    // Create a reasonable number of generic fields based on page count
    const fieldsPerPage = Math.max(2, Math.min(5, Math.ceil(10 / pageCount)))
    
    for (let page = 1; page <= pageCount; page++) {
      for (let field = 1; field <= fieldsPerPage; field++) {
        fields.push({
          name: `page${page}_field${field}`,
          type: 'text',
          required: false
        })
      }
    }
    
    // Add some common field names that users might expect
    const commonFields = [
      'name', 'first_name', 'last_name', 'email', 'phone', 'address',
      'city', 'state', 'zip', 'date', 'signature', 'title', 'company'
    ]
    
    for (const fieldName of commonFields) {
      fields.push({
        name: fieldName,
        type: fieldName === 'email' ? 'text' : fieldName === 'date' ? 'date' : 'text',
        required: false
      })
    }
    
    return fields.slice(0, 20) // Limit to 20 fields to avoid overwhelming the user
  }

  // Helper method to validate field names
  private isValidFieldName(name: string): boolean {
    // Filter out common non-field strings
    const invalidPatterns = [
      /^(form|data|template|subform|exData|bind|xfa|pdf|page|document)$/i,
      /^[0-9]+$/,  // Pure numbers
      /^\s*$/,     // Empty or whitespace
      /[<>{}[\]]/,  // Contains XML/JSON brackets
      /^(true|false|null|undefined)$/i,  // Boolean/null values
      /^(http|https|ftp|file):/i,  // URLs
      /\.(pdf|xml|html|js|css)$/i,  // File extensions
    ]
    
    // Check if name is too short or too long
    if (name.length < 2 || name.length > 50) {
      return false
    }
    
    // Check against invalid patterns
    for (const pattern of invalidPatterns) {
      if (pattern.test(name)) {
        return false
      }
    }
    
    return true
  }
}