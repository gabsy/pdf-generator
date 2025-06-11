import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib'
import { PDFTemplate, User, FieldMapping, GenerationProgress } from '../types'
import JSZip from 'jszip'
import { deepScanPDFForFields, hasPDFFormElements } from '../utils/pdfUtils'

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

  // Extract form fields from a PDF template
  async extractFormFields(pdfData: ArrayBuffer): Promise<{ fields: any[], pageCount: number }> {
    try {
      const pdfDoc = await PDFDocument.load(pdfData)
      const pageCount = pdfDoc.getPageCount()
      let extractedFields: any[] = []
      
      console.log(`PDF loaded successfully with ${pageCount} pages`)
      
      // First attempt: Try to get form fields using standard PDF-lib approach
      try {
        const form = pdfDoc.getForm()
        const fields = form.getFields()
        
        console.log(`Found ${fields.length} fields using standard method`)
        
        for (const field of fields) {
          try {
            const fieldName = field.getName()
            let fieldType = 'text'
            let options = undefined
            
            // Determine field type
            if (field.constructor.name.includes('Checkbox')) {
              fieldType = 'checkbox'
            } else if (field.constructor.name.includes('Radio')) {
              fieldType = 'radio'
              try {
                const radioField = field as PDFRadioGroup
                options = radioField.getOptions()
              } catch (e) {
                console.warn('Could not extract radio options:', e)
              }
            } else if (field.constructor.name.includes('Dropdown')) {
              fieldType = 'dropdown'
              try {
                const dropdown = field as PDFDropdown
                options = dropdown.getOptions()
              } catch (e) {
                console.warn('Could not extract dropdown options:', e)
              }
            } else if (field.constructor.name.includes('Text')) {
              fieldType = 'text'
            }
            
            extractedFields.push({
              name: fieldName,
              type: fieldType,
              required: false, // Default to false as PDF-lib doesn't provide this info
              options
            })
          } catch (fieldError) {
            console.warn('Error processing field:', fieldError)
          }
        }
      } catch (formError) {
        console.warn('Error accessing form using standard method:', formError)
      }
      
      // If no fields were found using PDF-lib, try alternative extraction methods
      if (extractedFields.length === 0) {
        console.log('No fields found using standard method, attempting alternative extraction')
        
        // Try deep scanning for field names
        const fieldNames = await deepScanPDFForFields(pdfData)
        
        if (fieldNames.length > 0) {
          console.log(`Found ${fieldNames.length} fields using deep scan`)
          
          extractedFields = fieldNames.map(name => ({
            name,
            type: 'text', // Default to text since we can't determine type
            required: false
          }))
        } else {
          // Check if the PDF has form elements even if we couldn't extract field names
          const hasFormElements = await hasPDFFormElements(pdfData)
          
          if (hasFormElements) {
            console.log('Form elements detected, but field names could not be extracted')
            
            // Create generic field names based on page numbers
            for (let i = 0; i < pageCount; i++) {
              for (let j = 1; j <= 3; j++) { // Create multiple fields per page
                extractedFields.push({
                  name: `field_page${i+1}_${j}`,
                  type: 'text',
                  required: false
                })
              }
            }
          } else {
            console.log('No form elements detected in the PDF')
            
            // Create generic fields anyway to allow manual mapping
            for (let i = 1; i <= Math.max(5, pageCount); i++) {
              extractedFields.push({
                name: `field_${i}`,
                type: 'text',
                required: false
              })
            }
          }
        }
      }
      
      return {
        fields: extractedFields,
        pageCount
      }
    } catch (error) {
      console.error('Error extracting form fields:', error)
      throw error
    }
  }
}