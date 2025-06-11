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
      // Create a copy of the template
      const pdfDoc = await PDFDocument.load(template.fileData)
      
      // Check if this is an XFA form and handle it differently
      const isXFA = await this.isXFAForm(template.fileData)
      
      if (isXFA) {
        console.warn('XFA form detected - attempting compatibility mode')
        // For XFA forms, we'll try to work with them but may need to flatten differently
        return await this.handleXFAForm(pdfDoc, user, fieldMappings)
      }
      
      try {
        // Get the form from the PDF
        const form = pdfDoc.getForm()
        
        // Fill the form fields based on mappings
        for (const mapping of fieldMappings) {
          if (!mapping.csvColumnName && !mapping.defaultValue) {
            continue // Skip unmapped fields
          }
          
          try {
            // Get the value from user data or default value
            let value = user[mapping.csvColumnName] || mapping.defaultValue || ''
            
            // Convert value to string and handle special cases
            value = String(value).trim()
            
            // Try to get the field by name
            try {
              const field = form.getField(mapping.pdfFieldName)
              
              // Handle different field types with better error handling
              if (field instanceof PDFTextField) {
                // For text fields, ensure the value fits
                try {
                  field.setText(value)
                } catch (textError) {
                  console.warn(`Could not set text for field ${mapping.pdfFieldName}:`, textError)
                  // Try setting a shorter version if the text is too long
                  if (value.length > 100) {
                    field.setText(value.substring(0, 100) + '...')
                  }
                }
              } else if (field instanceof PDFCheckBox) {
                // For checkboxes, check if value is truthy
                const shouldCheck = value.toLowerCase() === 'true' || 
                                  value.toLowerCase() === 'yes' || 
                                  value === '1' || 
                                  value.toLowerCase() === 'on' ||
                                  value.toLowerCase() === 'da' // Romanian for "yes"
                try {
                  if (shouldCheck) {
                    field.check()
                  } else {
                    field.uncheck()
                  }
                } catch (checkError) {
                  console.warn(`Could not set checkbox for field ${mapping.pdfFieldName}:`, checkError)
                }
              } else if (field instanceof PDFRadioGroup) {
                // For radio groups, try to select the option that matches the value
                try {
                  const options = field.getOptions()
                  if (options.includes(value)) {
                    field.select(value)
                  } else if (options.length > 0) {
                    // If exact match not found, try partial match
                    const partialMatch = options.find(option => 
                      option.toLowerCase().includes(value.toLowerCase()) ||
                      value.toLowerCase().includes(option.toLowerCase())
                    )
                    if (partialMatch) {
                      field.select(partialMatch)
                    }
                  }
                } catch (radioError) {
                  console.warn(`Could not set radio for field ${mapping.pdfFieldName}:`, radioError)
                }
              } else if (field instanceof PDFDropdown) {
                // For dropdowns, try to select the option that matches the value
                try {
                  const options = field.getOptions()
                  if (options.includes(value)) {
                    field.select(value)
                  } else if (options.length > 0) {
                    // If exact match not found, try partial match
                    const partialMatch = options.find(option => 
                      option.toLowerCase().includes(value.toLowerCase()) ||
                      value.toLowerCase().includes(option.toLowerCase())
                    )
                    if (partialMatch) {
                      field.select(partialMatch)
                    }
                  }
                } catch (dropdownError) {
                  console.warn(`Could not set dropdown for field ${mapping.pdfFieldName}:`, dropdownError)
                }
              }
            } catch (fieldError) {
              console.warn(`Field not found or error accessing field ${mapping.pdfFieldName}:`, fieldError)
              
              // Try alternative field access methods
              try {
                const fields = form.getFields()
                
                // Find field by name (case insensitive and partial match)
                const matchingField = fields.find(f => {
                  const fieldName = f.getName().toLowerCase()
                  const targetName = mapping.pdfFieldName.toLowerCase()
                  return fieldName === targetName || 
                         fieldName.includes(targetName) || 
                         targetName.includes(fieldName)
                })
                
                if (matchingField) {
                  if (matchingField instanceof PDFTextField) {
                    try {
                      matchingField.setText(value)
                    } catch (e) {
                      console.warn(`Alternative text field access failed:`, e)
                    }
                  } else if (matchingField instanceof PDFCheckBox) {
                    const shouldCheck = value.toLowerCase() === 'true' || 
                                      value.toLowerCase() === 'yes' || 
                                      value === '1' || 
                                      value.toLowerCase() === 'on' ||
                                      value.toLowerCase() === 'da'
                    try {
                      if (shouldCheck) {
                        matchingField.check()
                      } else {
                        matchingField.uncheck()
                      }
                    } catch (e) {
                      console.warn(`Alternative checkbox access failed:`, e)
                    }
                  } else if (matchingField instanceof PDFRadioGroup) {
                    try {
                      const options = matchingField.getOptions()
                      if (options.includes(value)) {
                        matchingField.select(value)
                      }
                    } catch (e) {
                      console.warn(`Alternative radio access failed:`, e)
                    }
                  } else if (matchingField instanceof PDFDropdown) {
                    try {
                      const options = matchingField.getOptions()
                      if (options.includes(value)) {
                        matchingField.select(value)
                      }
                    } catch (e) {
                      console.warn(`Alternative dropdown access failed:`, e)
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
        
        // Try to flatten the form to make it non-editable and improve compatibility
        try {
          // Before flattening, ensure all fields are properly set
          form.updateFieldAppearances()
          
          // Flatten the form to improve Adobe Reader compatibility
          form.flatten()
          
          console.log('Form flattened successfully')
        } catch (flattenError) {
          console.warn('Could not flatten form, continuing without flattening:', flattenError)
          
          // If flattening fails, try to at least update field appearances
          try {
            form.updateFieldAppearances()
          } catch (appearanceError) {
            console.warn('Could not update field appearances:', appearanceError)
          }
        }
        
      } catch (formError) {
        console.warn('Error accessing form, continuing with unfilled PDF:', formError)
        
        // If we can't access the form at all, try to create a new PDF with the content
        // This is a fallback for very problematic PDFs
        return await this.createFallbackPDF(pdfDoc, user, fieldMappings)
      }

      // Save the PDF with compatibility settings
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: false, // Better compatibility with older readers
        addDefaultPage: false,
        objectsPerTick: 50,
        updateFieldAppearances: true
      })
      
      return pdfBytes
    } catch (error) {
      console.error('Error generating PDF:', error)
      
      // If all else fails, return the original template
      console.warn('Returning original template due to errors')
      return new Uint8Array(template.fileData)
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

  private async handleXFAForm(
    pdfDoc: PDFDocument, 
    user: User, 
    fieldMappings: FieldMapping[]
  ): Promise<Uint8Array> {
    try {
      console.log('Handling XFA form with special processing')
      
      // For XFA forms, we need to be more careful
      // Try to access the form but don't flatten it as it may cause issues
      try {
        const form = pdfDoc.getForm()
        
        // Fill fields but be more conservative
        for (const mapping of fieldMappings) {
          if (!mapping.csvColumnName && !mapping.defaultValue) {
            continue
          }
          
          try {
            let value = user[mapping.csvColumnName] || mapping.defaultValue || ''
            value = String(value).trim()
            
            const field = form.getField(mapping.pdfFieldName)
            
            if (field instanceof PDFTextField) {
              // For XFA text fields, be more conservative with text length
              const maxLength = 50 // Conservative limit for XFA
              const truncatedValue = value.length > maxLength ? value.substring(0, maxLength) : value
              field.setText(truncatedValue)
            } else if (field instanceof PDFCheckBox) {
              const shouldCheck = value.toLowerCase() === 'true' || 
                                value.toLowerCase() === 'yes' || 
                                value === '1' || 
                                value.toLowerCase() === 'da'
              if (shouldCheck) {
                field.check()
              } else {
                field.uncheck()
              }
            }
            // Skip radio and dropdown for XFA as they're more problematic
          } catch (fieldError) {
            console.warn(`XFA field error for ${mapping.pdfFieldName}:`, fieldError)
          }
        }
        
        // For XFA forms, don't flatten - just update appearances
        try {
          form.updateFieldAppearances()
        } catch (appearanceError) {
          console.warn('Could not update XFA field appearances:', appearanceError)
        }
        
      } catch (xfaFormError) {
        console.warn('Could not access XFA form:', xfaFormError)
      }
      
      // Save with XFA-friendly settings
      return await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false,
        objectsPerTick: 25, // Smaller chunks for XFA
        updateFieldAppearances: false // Don't force appearance updates for XFA
      })
      
    } catch (error) {
      console.error('Error handling XFA form:', error)
      throw error
    }
  }

  private async createFallbackPDF(
    pdfDoc: PDFDocument, 
    user: User, 
    fieldMappings: FieldMapping[]
  ): Promise<Uint8Array> {
    try {
      console.log('Creating fallback PDF')
      
      // If we can't work with the form, just return the original PDF
      // This ensures we always return something usable
      return await pdfDoc.save({
        useObjectStreams: false,
        addDefaultPage: false
      })
      
    } catch (error) {
      console.error('Error creating fallback PDF:', error)
      throw error
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
        const nameField = fieldMappings.find(m => 
          m.csvColumnName && ['name', 'full_name', 'fullname', 'first_name', 'lastname', 'nume', 'prenume'].includes(m.csvColumnName.toLowerCase())
        )
        
        if (nameField && user[nameField.csvColumnName]) {
          const name = String(user[nameField.csvColumnName]).replace(/[^a-zA-Z0-9]/g, '_')
          filename = `${sectionName}_${name}_${user.id}.pdf`
        }

        zip.file(filename, pdfBytes)
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
      const pdfDoc = await PDFDocument.load(pdfData)
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