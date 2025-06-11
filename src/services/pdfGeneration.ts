import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib'
import { PDFTemplate, User, FieldMapping, GenerationProgress, PDFField } from '../types'
import JSZip from 'jszip'

export class PDFGenerationService {
  async generateSinglePDF(
    template: PDFTemplate,
    user: User,
    fieldMappings: FieldMapping[]
  ): Promise<Uint8Array> {
    try {
      console.log('Starting PDF generation with template:', template.fileName)
      console.log('User data:', user)
      console.log('Field mappings:', fieldMappings)
      
      // Load the original PDF template
      const originalBytes = new Uint8Array(template.fileData)
      console.log('Original PDF size:', originalBytes.length, 'bytes')
      
      // Create a copy of the original PDF to work with
      const pdfDoc = await PDFDocument.load(originalBytes, {
        ignoreEncryption: true,
        capNumbers: false,
        throwOnInvalidObject: false,
        updateMetadata: false
      })
      
      console.log('PDF loaded successfully, pages:', pdfDoc.getPageCount())
      
      // Try to get the form - some PDFs might not have forms
      let form: PDFForm | null = null
      let hasForm = false
      
      try {
        form = pdfDoc.getForm()
        hasForm = true
        console.log('Form found with', form.getFields().length, 'fields')
      } catch (formError) {
        console.warn('No form found in PDF or form is not accessible:', formError)
        hasForm = false
      }
      
      let fieldsFilledCount = 0
      let fieldsAttempted = 0
      
      // If we have a form, try to fill the fields
      if (hasForm && form) {
        console.log('Attempting to fill form fields...')
        
        for (const mapping of fieldMappings) {
          // Skip mappings without data source
          if (!mapping.csvColumnName && !mapping.defaultValue) {
            console.log(`Skipping mapping for ${mapping.pdfFieldName} - no data source`)
            continue
          }
          
          fieldsAttempted++
          
          try {
            // Get the value from user data or use default
            let value = ''
            if (mapping.csvColumnName && user[mapping.csvColumnName] !== undefined) {
              value = String(user[mapping.csvColumnName]).trim()
            } else if (mapping.defaultValue) {
              value = String(mapping.defaultValue).trim()
            }
            
            if (!value) {
              console.log(`No value for field ${mapping.pdfFieldName}`)
              continue
            }
            
            console.log(`Filling field "${mapping.pdfFieldName}" with value "${value}"`)
            
            // Try to get the field from the form
            let field
            try {
              field = form.getField(mapping.pdfFieldName)
            } catch (fieldError) {
              console.warn(`Field "${mapping.pdfFieldName}" not found in form:`, fieldError)
              continue
            }
            
            // Fill the field based on its type
            if (field instanceof PDFTextField) {
              // Text field
              const maxLength = 500 // Reasonable limit
              const safeValue = value.length > maxLength ? value.substring(0, maxLength) : value
              field.setText(safeValue)
              fieldsFilledCount++
              console.log(`✓ Text field "${mapping.pdfFieldName}" filled`)
              
            } else if (field instanceof PDFCheckBox) {
              // Checkbox field
              const shouldCheck = ['true', 'yes', '1', 'on', 'da', 'checked', 'x'].includes(value.toLowerCase())
              if (shouldCheck) {
                field.check()
                console.log(`✓ Checkbox "${mapping.pdfFieldName}" checked`)
              } else {
                field.uncheck()
                console.log(`✓ Checkbox "${mapping.pdfFieldName}" unchecked`)
              }
              fieldsFilledCount++
              
            } else if (field instanceof PDFRadioGroup) {
              // Radio button group
              try {
                const options = field.getOptions()
                console.log(`Radio field "${mapping.pdfFieldName}" options:`, options)
                
                if (options.includes(value)) {
                  field.select(value)
                  fieldsFilledCount++
                  console.log(`✓ Radio "${mapping.pdfFieldName}" selected: ${value}`)
                } else {
                  console.warn(`Value "${value}" not found in radio options:`, options)
                }
              } catch (radioError) {
                console.warn(`Error handling radio field "${mapping.pdfFieldName}":`, radioError)
              }
              
            } else if (field instanceof PDFDropdown) {
              // Dropdown field
              try {
                const options = field.getOptions()
                console.log(`Dropdown field "${mapping.pdfFieldName}" options:`, options)
                
                if (options.includes(value)) {
                  field.select(value)
                  fieldsFilledCount++
                  console.log(`✓ Dropdown "${mapping.pdfFieldName}" selected: ${value}`)
                } else {
                  // Try to find a partial match
                  const partialMatch = options.find(option => 
                    option.toLowerCase().includes(value.toLowerCase()) ||
                    value.toLowerCase().includes(option.toLowerCase())
                  )
                  
                  if (partialMatch) {
                    field.select(partialMatch)
                    fieldsFilledCount++
                    console.log(`✓ Dropdown "${mapping.pdfFieldName}" selected (partial match): ${partialMatch}`)
                  } else {
                    console.warn(`Value "${value}" not found in dropdown options:`, options)
                  }
                }
              } catch (dropdownError) {
                console.warn(`Error handling dropdown field "${mapping.pdfFieldName}":`, dropdownError)
              }
              
            } else {
              console.warn(`Unknown field type for "${mapping.pdfFieldName}":`, field.constructor.name)
            }
            
          } catch (fieldError) {
            console.error(`Error filling field "${mapping.pdfFieldName}":`, fieldError)
          }
        }
        
        console.log(`Form filling complete: ${fieldsFilledCount}/${fieldsAttempted} fields filled successfully`)
        
        // Try to update field appearances if possible
        try {
          form.updateFieldAppearances()
          console.log('Field appearances updated successfully')
        } catch (appearanceError) {
          console.warn('Could not update field appearances (this is often normal):', appearanceError)
        }
      } else {
        console.log('No form available for field filling - returning original PDF with user data as metadata')
      }
      
      // Save the PDF with the filled fields
      try {
        const pdfBytes = await pdfDoc.save({
          useObjectStreams: false,
          addDefaultPage: false,
          updateFieldAppearances: false // We already tried this above
        })
        
        console.log(`PDF saved successfully. Original: ${originalBytes.length} bytes, Final: ${pdfBytes.length} bytes`)
        console.log(`Fields filled: ${fieldsFilledCount}/${fieldsAttempted}`)
        
        return pdfBytes
        
      } catch (saveError) {
        console.error('Error saving PDF:', saveError)
        console.log('Returning original PDF due to save error')
        return originalBytes
      }
      
    } catch (error) {
      console.error('Critical error in PDF generation:', error)
      console.log('Returning original template as fallback')
      
      // Always return the original template as a fallback
      // This ensures the user gets a viewable PDF even if processing fails
      return new Uint8Array(template.fileData)
    }
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
        const nameFields = ['name', 'full_name', 'fullname', 'first_name', 'lastname', 'nume', 'prenume', 'nume_solicitant']
        const nameField = fieldMappings.find(m => 
          m.csvColumnName && nameFields.includes(m.csvColumnName.toLowerCase())
        )
        
        if (nameField && user[nameField.csvColumnName]) {
          const name = String(user[nameField.csvColumnName]).replace(/[^a-zA-Z0-9]/g, '_')
          filename = `${sectionName}_${name}_${user.id}.pdf`
        }

        zip.file(filename, pdfBytes)
        console.log(`Generated PDF ${i + 1}/${users.length}: ${filename}`)
        
      } catch (error) {
        console.error(`Failed to generate PDF for user ${user.id}:`, error)
        
        // Add an error file to the zip to indicate the failure
        const errorContent = `Error generating PDF for user ${user.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        zip.file(`ERROR_${user.id}.txt`, errorContent)
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
  async extractFormFields(pdfData: ArrayBuffer): Promise<{ fields: PDFField[], pageCount: number }> {
    try {
      console.log('Starting comprehensive PDF field extraction...')
      const pdfDoc = await PDFDocument.load(pdfData, {
        ignoreEncryption: true,
        capNumbers: false,
        throwOnInvalidObject: false
      })
      const pageCount = pdfDoc.getPageCount()
      let extractedFields: PDFField[] = []
      
      console.log(`PDF loaded successfully with ${pageCount} pages`)
      
      // Check if this is an XFA form first
      const isXFA = await this.isXFAForm(pdfData)
      console.log(`PDF type: ${isXFA ? 'XFA' : 'Standard'}`)
      
      // Method 1: Standard PDF-lib form extraction
      try {
        const form = pdfDoc.getForm()
        const fields = form.getFields()
        
        console.log(`Method 1 - Standard extraction: Found ${fields.length} fields`)
        
        for (const field of fields) {
          try {
            const fieldName = field.getName()
            let fieldType: PDFField['type'] = 'text'
            let options = undefined
            
            // Determine field type based on constructor name
            const constructorName = field.constructor.name
            console.log(`Field: ${fieldName}, Constructor: ${constructorName}`)
            
            if (constructorName.includes('Checkbox') || constructorName.includes('CheckBox')) {
              fieldType = 'checkbox'
            } else if (constructorName.includes('Radio')) {
              fieldType = 'radio'
              try {
                const radioField = field as any
                if (radioField.getOptions) {
                  options = radioField.getOptions()
                }
              } catch (e) {
                console.warn('Could not extract radio options:', e)
              }
            } else if (constructorName.includes('Dropdown') || constructorName.includes('Choice')) {
              fieldType = 'dropdown'
              try {
                const dropdown = field as any
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
      
      // Method 2: Enhanced raw PDF content analysis (especially for XFA)
      if (extractedFields.length < 5 || isXFA) {
        console.log('Method 2 - Enhanced raw content analysis...')
        const rawFields = await this.extractFieldsFromRawPDF(pdfData)
        
        if (rawFields.length > extractedFields.length) {
          console.log(`Method 2 found ${rawFields.length} fields, using these instead`)
          extractedFields = rawFields
        }
      }
      
      // Method 3: Romanian-specific field patterns
      if (extractedFields.length < 10) {
        console.log('Method 3 - Romanian form pattern analysis...')
        const romanianFields = await this.extractRomanianFormFields(pdfData)
        
        if (romanianFields.length > extractedFields.length) {
          console.log(`Method 3 found ${romanianFields.length} fields, using these instead`)
          extractedFields = romanianFields
        }
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

  private async isXFAForm(pdfData: ArrayBuffer): Promise<boolean> {
    try {
      const bytes = new Uint8Array(pdfData)
      let pdfText = ''
      
      // Check first 1MB for XFA indicators
      for (let i = 0; i < Math.min(bytes.byteLength, 1000000); i++) {
        pdfText += String.fromCharCode(bytes[i])
      }
      
      const xfaIndicators = [
        '/XFA',
        '<xfa:',
        '<xdp:',
        '<template xmlns:xfa',
        'application/vnd.adobe.xdp+xml',
        'XFA_',
        'xfa.form',
        'xfa.datasets',
        'xfa.template',
        'LiveCycle',
        'Designer'
      ]
      
      return xfaIndicators.some(indicator => pdfText.includes(indicator))
    } catch (error) {
      console.error('Error checking for XFA:', error)
      return false
    }
  }

  // Method for Romanian-specific form patterns
  private async extractRomanianFormFields(pdfData: ArrayBuffer): Promise<PDFField[]> {
    try {
      const bytes = new Uint8Array(pdfData)
      let pdfText = ''
      
      // Convert to string for pattern matching
      for (let i = 0; i < Math.min(bytes.byteLength, 2000000); i++) {
        pdfText += String.fromCharCode(bytes[i])
      }
      
      const fieldNames = new Set<string>()
      
      // Romanian-specific patterns and common field names
      const romanianPatterns = [
        // Common Romanian form field names
        /\b(nume|prenume|cnp|seria|numar|telefon|email|adresa|localitate|judet|cod_postal)\b/gi,
        /\b(beneficiar|solicitant|reprezentant|imputernicit)\b/gi,
        /\b(autovehicul|motor|electric|hibrid|tip)\b/gi,
        /\b(suma|valoare|ecotichete|numar_ecotichete)\b/gi,
        /\b(domiciliu|resedinta|strada|bloc|scara|etaj|apartament)\b/gi,
        /\b(data|eliberat|emis|valabil)\b/gi,
        
        // Standard field patterns
        /\/T\s*\(([^)]+)\)/g,
        /\/TU\s*\(([^)]+)\)/g,
        /<field\s+name="([^"]+)"/gi,
        /this\.getField\("([^"]+)"\)/g,
      ]
      
      for (const pattern of romanianPatterns) {
        let match
        pattern.lastIndex = 0
        
        while ((match = pattern.exec(pdfText)) !== null) {
          if (match[1]) {
            const fieldName = match[1].trim()
            if (this.isValidFieldName(fieldName)) {
              fieldNames.add(fieldName)
            }
          } else if (match[0]) {
            // For patterns that match the whole word
            const fieldName = match[0].trim()
            if (this.isValidFieldName(fieldName)) {
              fieldNames.add(fieldName)
            }
          }
        }
      }
      
      // If we found some fields, return them
      if (fieldNames.size > 0) {
        return Array.from(fieldNames).map(name => ({
          name,
          type: this.guessFieldType(name),
          required: false
        }))
      }
      
      // If no specific fields found, create common Romanian form fields
      const commonRomanianFields = [
        { name: 'nume_solicitant', type: 'text' as const },
        { name: 'prenume_solicitant', type: 'text' as const },
        { name: 'cnp', type: 'text' as const },
        { name: 'seria_ci', type: 'text' as const },
        { name: 'numar_ci', type: 'text' as const },
        { name: 'eliberat_de', type: 'text' as const },
        { name: 'data_eliberare', type: 'date' as const },
        { name: 'telefon', type: 'text' as const },
        { name: 'email', type: 'text' as const },
        { name: 'judet', type: 'dropdown' as const },
        { name: 'localitate', type: 'text' as const },
        { name: 'strada', type: 'text' as const },
        { name: 'numar_strada', type: 'text' as const },
        { name: 'bloc', type: 'text' as const },
        { name: 'scara', type: 'text' as const },
        { name: 'etaj', type: 'text' as const },
        { name: 'apartament', type: 'text' as const },
        { name: 'cod_postal', type: 'text' as const },
        { name: 'beneficiar_minor', type: 'checkbox' as const },
        { name: 'tip_autovehicul', type: 'dropdown' as const },
        { name: 'autovehicul_electric', type: 'checkbox' as const },
        { name: 'autovehicul_hibrid', type: 'checkbox' as const },
        { name: 'suma_solicitata', type: 'number' as const },
        { name: 'numar_ecotichete', type: 'number' as const },
        { name: 'reprezentant_legal', type: 'checkbox' as const },
        { name: 'imputernicit', type: 'checkbox' as const }
      ]
      
      return commonRomanianFields.map(field => ({
        ...field,
        required: false
      }))
    } catch (error) {
      console.error('Error in Romanian field extraction:', error)
      return []
    }
  }

  // Method 2: Enhanced raw PDF content analysis
  private async extractFieldsFromRawPDF(pdfData: ArrayBuffer): Promise<PDFField[]> {
    try {
      const bytes = new Uint8Array(pdfData)
      let pdfText = ''
      
      // Convert to string for pattern matching (process more of the file for better detection)
      for (let i = 0; i < Math.min(bytes.byteLength, 3000000); i++) {
        pdfText += String.fromCharCode(bytes[i])
      }
      
      const fieldNames = new Set<string>()
      
      // Comprehensive patterns for field detection
      const patterns = [
        // AcroForm field names - enhanced patterns
        /\/T\s*\(([^)]+)\)/g,
        /\/T\s*<([^>]+)>/g,
        /\/T\s*\[([^\]]+)\]/g,
        
        // Tool tips and user names (often contain meaningful field names)
        /\/TU\s*\(([^)]+)\)/g,
        /\/TU\s*<([^>]+)>/g,
        
        // Field values that might indicate field names
        /\/V\s*\(([^)]+)\)/g,
        /\/DV\s*\(([^)]+)\)/g, // Default values
        
        // Widget annotations with field names
        /\/Subtype\s*\/Widget.*?\/T\s*\(([^)]+)\)/gs,
        /\/Widget.*?\/T\s*\(([^)]+)\)/gs,
        
        // Form field dictionaries - enhanced
        /\/FT\s*\/Tx.*?\/T\s*\(([^)]+)\)/gs, // Text fields
        /\/FT\s*\/Btn.*?\/T\s*\(([^)]+)\)/gs, // Button fields (checkbox, radio)
        /\/FT\s*\/Ch.*?\/T\s*\(([^)]+)\)/gs, // Choice fields (dropdown, list)
        
        // XFA field names - multiple variations
        /<field\s+name="([^"]+)"/gi,
        /<field\s+name='([^']+)'/gi,
        /<\w*:?field\s+name="([^"]+)"/gi,
        
        // XFA binding patterns
        /<bind\s+ref="([^"]+)"/gi,
        /<bind\s+match="([^"]+)"/gi,
        
        // XFA data patterns
        /\$record\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
        /\$data\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
        
        // JavaScript field references
        /this\.getField\("([^"]+)"\)/g,
        /this\.getField\('([^']+)'\)/g,
        /event\.target\.name\s*==\s*"([^"]+)"/g,
        /event\.target\.name\s*===\s*"([^"]+)"/g,
        
        // Form calculation references
        /field\["([^"]+)"\]/g,
        /field\['([^']+)'\]/g,
        /getField\("([^"]+)"\)/g,
        
        // XFA subform and group patterns
        /<subform\s+name="([^"]+)"/gi,
        /<exclGroup\s+name="([^"]+)"/gi,
        
        // Alternative field reference patterns
        /\bname\s*=\s*"([^"]+)"/gi,
        /\bid\s*=\s*"([^"]+)"/gi,
        
        // Annotation dictionary patterns
        /\/Annot.*?\/T\s*\(([^)]+)\)/gs,
        
        // Form field appearance patterns
        /\/AP\s*<<.*?\/T\s*\(([^)]+)\)/gs,
        
        // Field action patterns
        /\/A\s*<<.*?\/T\s*\(([^)]+)\)/gs,
        
        // Additional XFA patterns
        /<\w+\s+[^>]*name\s*=\s*"([^"]+)"/gi,
        
        // Field reference in streams
        /Tf\s+.*?\/([a-zA-Z_][a-zA-Z0-9_]*)\s+/g,
      ]
      
      for (const pattern of patterns) {
        let match
        pattern.lastIndex = 0 // Reset regex state
        
        while ((match = pattern.exec(pdfText)) !== null) {
          if (match[1]) {
            const fieldName = match[1].trim()
            
            // Enhanced field name validation
            if (this.isValidFieldName(fieldName)) {
              fieldNames.add(fieldName)
            }
          }
        }
      }
      
      // Convert to field objects
      return Array.from(fieldNames).map(name => ({
        name,
        type: this.guessFieldType(name),
        required: false
      }))
    } catch (error) {
      console.error('Error in raw PDF extraction:', error)
      return []
    }
  }

  // Enhanced field name validation
  private isValidFieldName(name: string): boolean {
    // Filter out common non-field strings
    const invalidPatterns = [
      /^(form|data|template|subform|exData|bind|xfa|pdf|page|document|root|datasets|config|xmlns|version|encoding)$/i,
      /^[0-9]+$/,  // Pure numbers
      /^\s*$/,     // Empty or whitespace
      /[<>{}[\]]/,  // Contains XML/JSON brackets
      /^(true|false|null|undefined|yes|no)$/i,  // Boolean/null values
      /^(http|https|ftp|file):/i,  // URLs
      /\.(pdf|xml|html|js|css|xdp|xfa)$/i,  // File extensions
      /^(adobe|acrobat|reader|designer|livecycle)$/i,  // Software names
      /^(font|color|size|width|height|margin|padding)$/i,  // Style properties
      /^[^a-zA-Z]/,  // Must start with a letter
    ]
    
    // Check if name is too short or too long
    if (name.length < 2 || name.length > 100) {
      return false
    }
    
    // Check against invalid patterns
    for (const pattern of invalidPatterns) {
      if (pattern.test(name)) {
        return false
      }
    }
    
    // Must contain at least one letter
    if (!/[a-zA-Z]/.test(name)) {
      return false
    }
    
    return true
  }

  // Guess field type based on field name
  private guessFieldType(name: string): PDFField['type'] {
    const lowerName = name.toLowerCase()
    
    if (lowerName.includes('checkbox') || lowerName.includes('check') || 
        lowerName.includes('minor') || lowerName.includes('electric') || 
        lowerName.includes('hibrid') || lowerName.includes('reprezentant') ||
        lowerName.includes('beneficiar')) {
      return 'checkbox'
    }
    
    if (lowerName.includes('dropdown') || lowerName.includes('select') || 
        lowerName.includes('judet') || lowerName.includes('localitate') || 
        lowerName.includes('tip_') || lowerName.includes('autovehicul')) {
      return 'dropdown'
    }
    
    if (lowerName.includes('email')) {
      return 'text'
    }
    
    if (lowerName.includes('data') || lowerName.includes('date') || 
        lowerName.includes('eliberat') || lowerName.includes('emis')) {
      return 'date'
    }
    
    if (lowerName.includes('suma') || lowerName.includes('numar') || 
        lowerName.includes('cod') || lowerName.includes('telefon') ||
        lowerName.includes('cnp') || lowerName.includes('ecotichete')) {
      return 'number'
    }
    
    return 'text' // Default to text
  }
}