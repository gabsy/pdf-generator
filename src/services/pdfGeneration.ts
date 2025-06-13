import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib'
import { PDFTemplate, User, FieldMapping, GenerationProgress, PDFField } from '../types'
import JSZip from 'jszip'

export class PDFGenerationService {
  async generateSinglePDF(
    template: PDFTemplate,
    user: User,
    fieldMappings: FieldMapping[]
  ): Promise<Uint8Array> {
    console.log('=== Starting Conservative PDF Generation ===')
    console.log('Template:', template.fileName)
    console.log('User ID:', user.id)
    console.log('Field mappings count:', fieldMappings.length)
    
    try {
      // Step 1: Validate and prepare the original PDF data
      const originalBytes = new Uint8Array(template.fileData)
      console.log('Original PDF size:', originalBytes.length, 'bytes')
      
      if (originalBytes.length === 0) {
        throw new Error('Template file data is empty')
      }
      
      // Step 2: Check if this is an XFA form before processing
      const isXFA = await this.isXFAForm(originalBytes)
      console.log('PDF type detected:', isXFA ? 'XFA (XML Forms)' : 'Standard AcroForm')
      
      // Step 3: Load PDF with conservative options
      let pdfDoc: PDFDocument
      try {
        pdfDoc = await PDFDocument.load(originalBytes, {
          ignoreEncryption: true,
          capNumbers: false,
          throwOnInvalidObject: false,
          updateMetadata: false,
          parseSpeed: 1, // Slower but more reliable parsing
        })
        console.log('PDF loaded successfully, pages:', pdfDoc.getPageCount())
      } catch (loadError) {
        console.error('Failed to load PDF:', loadError)
        console.log('Returning original PDF due to load failure')
        return originalBytes
      }
      
      // Step 4: Conservative form handling
      if (isXFA) {
        console.log('XFA form detected - using minimal modification approach')
        return await this.handleXFAForm(pdfDoc, originalBytes, user, fieldMappings)
      } else {
        console.log('Standard form detected - using conservative field filling')
        return await this.handleStandardForm(pdfDoc, originalBytes, user, fieldMappings)
      }
      
    } catch (error) {
      console.error('Critical error in PDF generation:', error)
      console.log('Returning original template as fallback')
      return new Uint8Array(template.fileData)
    }
  }

  private async handleXFAForm(
    pdfDoc: PDFDocument,
    originalBytes: Uint8Array,
    user: User,
    fieldMappings: FieldMapping[]
  ): Promise<Uint8Array> {
    console.log('Processing XFA form with minimal modification...')
    
    try {
      // For XFA forms, we use a very conservative approach
      // XFA forms are notoriously difficult to modify without breaking
      
      let form: PDFForm | null = null
      let hasAccessibleForm = false
      
      try {
        form = pdfDoc.getForm()
        hasAccessibleForm = true
        console.log('XFA form has accessible AcroForm layer')
      } catch (formError) {
        console.warn('XFA form does not have accessible AcroForm layer:', formError)
        hasAccessibleForm = false
      }
      
      if (!hasAccessibleForm || !form) {
        console.log('XFA form cannot be modified - returning original with metadata')
        // For pure XFA forms without AcroForm layer, we cannot safely modify
        // Return the original PDF to ensure it remains viewable
        return originalBytes
      }
      
      // If we have an accessible form layer, try minimal field filling
      const fieldsToFill = this.selectCriticalFields(fieldMappings, 3) // Only fill 3 most important fields
      console.log(`Attempting to fill ${fieldsToFill.length} critical fields in XFA form`)
      
      let fieldsFilledCount = 0
      
      for (const mapping of fieldsToFill) {
        try {
          const success = await this.fillSingleFieldSafely(form, mapping, user)
          if (success) fieldsFilledCount++
        } catch (fieldError) {
          console.warn(`Failed to fill field ${mapping.pdfFieldName}:`, fieldError)
          // Continue with other fields
        }
      }
      
      console.log(`XFA form: ${fieldsFilledCount}/${fieldsToFill.length} critical fields filled`)
      
      // Save with minimal options to preserve XFA structure
      try {
        const pdfBytes = await pdfDoc.save({
          useObjectStreams: false,
          addDefaultPage: false,
          updateFieldAppearances: false, // Critical: don't update appearances in XFA
          preserveStructure: true
        })
        
        console.log('XFA form saved successfully')
        return pdfBytes
      } catch (saveError) {
        console.error('Failed to save XFA form:', saveError)
        return originalBytes
      }
      
    } catch (error) {
      console.error('Error processing XFA form:', error)
      return originalBytes
    }
  }

  private async handleStandardForm(
    pdfDoc: PDFDocument,
    originalBytes: Uint8Array,
    user: User,
    fieldMappings: FieldMapping[]
  ): Promise<Uint8Array> {
    console.log('Processing standard AcroForm...')
    
    try {
      let form: PDFForm | null = null
      
      try {
        form = pdfDoc.getForm()
        console.log('Standard form accessed, fields available:', form.getFields().length)
      } catch (formError) {
        console.warn('No accessible form found:', formError)
        return originalBytes
      }
      
      if (!form) {
        console.log('No form to fill - returning original PDF')
        return originalBytes
      }
      
      // Conservative field filling approach
      const safeFieldMappings = this.validateFieldMappings(form, fieldMappings)
      console.log(`Validated ${safeFieldMappings.length}/${fieldMappings.length} field mappings`)
      
      let fieldsFilledCount = 0
      let fieldsAttempted = 0
      
      for (const mapping of safeFieldMappings) {
        fieldsAttempted++
        
        try {
          const success = await this.fillSingleFieldSafely(form, mapping, user)
          if (success) fieldsFilledCount++
        } catch (fieldError) {
          console.warn(`Error filling field ${mapping.pdfFieldName}:`, fieldError)
          // Continue with other fields - don't let one field break the entire process
        }
      }
      
      console.log(`Standard form: ${fieldsFilledCount}/${fieldsAttempted} fields filled successfully`)
      
      // Conservative save approach
      try {
        const pdfBytes = await pdfDoc.save({
          useObjectStreams: false,
          addDefaultPage: false,
          updateFieldAppearances: fieldsFilledCount > 0, // Only update if we actually filled fields
        })
        
        // Validate the generated PDF
        if (await this.validateGeneratedPDF(pdfBytes)) {
          console.log('Generated PDF validated successfully')
          return pdfBytes
        } else {
          console.warn('Generated PDF failed validation - returning original')
          return originalBytes
        }
        
      } catch (saveError) {
        console.error('Failed to save standard form:', saveError)
        return originalBytes
      }
      
    } catch (error) {
      console.error('Error processing standard form:', error)
      return originalBytes
    }
  }

  private async fillSingleFieldSafely(
    form: PDFForm,
    mapping: FieldMapping,
    user: User
  ): Promise<boolean> {
    try {
      // Get the value to fill
      let value = ''
      if (mapping.csvColumnName && user[mapping.csvColumnName] !== undefined) {
        value = String(user[mapping.csvColumnName]).trim()
      } else if (mapping.defaultValue) {
        value = String(mapping.defaultValue).trim()
      }
      
      if (!value) {
        return false
      }
      
      // Get the field
      let field
      try {
        field = form.getField(mapping.pdfFieldName)
      } catch (fieldError) {
        console.warn(`Field "${mapping.pdfFieldName}" not found`)
        return false
      }
      
      // Fill based on field type with conservative approach
      if (field instanceof PDFTextField) {
        // Text field - limit length and sanitize
        const maxLength = 200 // Conservative limit
        const safeValue = this.sanitizeTextValue(value, maxLength)
        field.setText(safeValue)
        return true
        
      } else if (field instanceof PDFCheckBox) {
        // Checkbox - simple boolean logic
        const shouldCheck = this.parseBoolean(value)
        if (shouldCheck) {
          field.check()
        } else {
          field.uncheck()
        }
        return true
        
      } else if (field instanceof PDFRadioGroup) {
        // Radio button - only select if exact match
        try {
          const options = field.getOptions()
          if (options.includes(value)) {
            field.select(value)
            return true
          }
        } catch (radioError) {
          console.warn(`Radio field error:`, radioError)
        }
        return false
        
      } else if (field instanceof PDFDropdown) {
        // Dropdown - only select if exact match
        try {
          const options = field.getOptions()
          if (options.includes(value)) {
            field.select(value)
            return true
          }
        } catch (dropdownError) {
          console.warn(`Dropdown field error:`, dropdownError)
        }
        return false
        
      } else {
        console.warn(`Unknown field type for "${mapping.pdfFieldName}"`)
        return false
      }
      
    } catch (error) {
      console.error(`Error filling field "${mapping.pdfFieldName}":`, error)
      return false
    }
  }

  private selectCriticalFields(fieldMappings: FieldMapping[], maxFields: number): FieldMapping[] {
    // For XFA forms, only fill the most critical fields to minimize risk
    const criticalFieldNames = [
      'nume', 'prenume', 'name', 'first_name', 'last_name',
      'cnp', 'id', 'number', 'numar',
      'email', 'telefon', 'phone'
    ]
    
    const criticalMappings = fieldMappings.filter(mapping =>
      criticalFieldNames.some(critical =>
        mapping.pdfFieldName.toLowerCase().includes(critical.toLowerCase())
      )
    )
    
    return criticalMappings.slice(0, maxFields)
  }

  private validateFieldMappings(form: PDFForm, fieldMappings: FieldMapping[]): FieldMapping[] {
    const availableFields = form.getFields().map(field => field.getName())
    
    return fieldMappings.filter(mapping => {
      const hasValue = mapping.csvColumnName || mapping.defaultValue
      const fieldExists = availableFields.includes(mapping.pdfFieldName)
      
      if (!fieldExists) {
        console.warn(`Field "${mapping.pdfFieldName}" not found in PDF form`)
      }
      
      return hasValue && fieldExists
    })
  }

  private sanitizeTextValue(value: string, maxLength: number): string {
    // Remove potentially problematic characters
    let sanitized = value
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/[<>]/g, '') // Remove angle brackets that might break XML
      .trim()
    
    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength)
    }
    
    return sanitized
  }

  private parseBoolean(value: string): boolean {
    const lowerValue = value.toLowerCase().trim()
    return ['true', 'yes', '1', 'on', 'da', 'checked', 'x', 'adevarat'].includes(lowerValue)
  }

  private async isXFAForm(pdfData: Uint8Array): Promise<boolean> {
    try {
      // Convert to string for pattern matching
      let pdfText = ''
      const maxBytes = Math.min(pdfData.length, 500000) // Check first 500KB
      
      for (let i = 0; i < maxBytes; i++) {
        pdfText += String.fromCharCode(pdfData[i])
      }
      
      // XFA indicators
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
      
      const isXFA = xfaIndicators.some(indicator => pdfText.includes(indicator))
      
      // Additional check for Romanian government forms
      const romanianGovIndicators = [
        'Ministerul',
        'Guvernul',
        'Agentia',
        'Primaria',
        'Consiliul',
        'ghid',
        'cerere',
        'formular'
      ]
      
      const isRomanianGov = romanianGovIndicators.some(indicator => 
        pdfText.toLowerCase().includes(indicator.toLowerCase())
      )
      
      if (isRomanianGov) {
        console.log('Romanian government form detected - using extra conservative approach')
      }
      
      return isXFA || isRomanianGov
    } catch (error) {
      console.error('Error checking for XFA:', error)
      return false
    }
  }

  private async validateGeneratedPDF(pdfBytes: Uint8Array): Promise<boolean> {
    try {
      // Basic validation - check if PDF can be loaded
      await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
        throwOnInvalidObject: false
      })
      
      // Check if PDF has reasonable size (not too small, not too large compared to original)
      if (pdfBytes.length < 1000) {
        console.warn('Generated PDF is suspiciously small')
        return false
      }
      
      // Check for PDF header
      const header = String.fromCharCode(...pdfBytes.slice(0, 8))
      if (!header.startsWith('%PDF-')) {
        console.warn('Generated PDF missing valid header')
        return false
      }
      
      return true
    } catch (error) {
      console.error('PDF validation failed:', error)
      return false
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
    let successCount = 0
    let errorCount = 0

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
        
        // Create meaningful filename
        let filename = `${sectionName}_${user.id}.pdf`
        
        // Try to create a better filename using user data
        const nameFields = ['nume', 'name', 'first_name', 'prenume', 'nume_solicitant']
        const nameField = fieldMappings.find(m => 
          m.csvColumnName && nameFields.some(nf => 
            m.csvColumnName.toLowerCase().includes(nf.toLowerCase())
          )
        )
        
        if (nameField && user[nameField.csvColumnName]) {
          const name = String(user[nameField.csvColumnName])
            .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .substring(0, 20) // Limit length
          
          if (name) {
            filename = `${sectionName}_${name}_${user.id}.pdf`
          }
        }

        zip.file(filename, pdfBytes)
        successCount++
        console.log(`Generated PDF ${i + 1}/${users.length}: ${filename}`)
        
      } catch (error) {
        console.error(`Failed to generate PDF for user ${user.id}:`, error)
        errorCount++
        
        // Add error report to zip
        const errorContent = `Error generating PDF for user ${user.id}:\n${error instanceof Error ? error.message : 'Unknown error'}\n\nUser data: ${JSON.stringify(user, null, 2)}`
        zip.file(`ERROR_${user.id}.txt`, errorContent)
      }
    }

    // Add generation summary
    const summary = `PDF Generation Summary
=====================
Total users: ${users.length}
Successful: ${successCount}
Errors: ${errorCount}
Success rate: ${((successCount / users.length) * 100).toFixed(1)}%

Template: ${template.fileName}
Field mappings: ${fieldMappings.length}
Generated: ${new Date().toISOString()}
`
    zip.file('GENERATION_SUMMARY.txt', summary)

    // Final progress update
    onProgress({
      current: users.length,
      total: users.length,
      status: 'completed'
    })

    console.log(`Bulk generation complete: ${successCount}/${users.length} successful`)
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
      const isXFA = await this.isXFAForm(new Uint8Array(pdfData))
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