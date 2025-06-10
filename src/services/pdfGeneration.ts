import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown } from 'pdf-lib'
import { PDFTemplate, User, FieldMapping, GenerationProgress } from '../types'

export class PDFGenerationService {
  async generateSinglePDF(
    template: PDFTemplate,
    user: User,
    fieldMappings: FieldMapping[]
  ): Promise<Uint8Array> {
    // Create a copy of the template
    const pdfDoc = await PDFDocument.load(template.fileData)
    const form = pdfDoc.getForm()

    // Fill the form fields
    for (const mapping of fieldMappings) {
      const field = form.getField(mapping.pdfFieldName)
      let value = user[mapping.csvColumnName] || mapping.defaultValue || ''
      
      // Convert value to string
      value = String(value)

      try {
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
      } catch (error) {
        console.warn(`Failed to set field ${mapping.pdfFieldName}:`, error)
      }
    }

    // Flatten the form to make it non-editable
    form.flatten()

    return pdfDoc.save()
  }

  async generateBulkPDFs(
    template: PDFTemplate,
    users: User[],
    fieldMappings: FieldMapping[],
    sectionName: string,
    onProgress: (progress: GenerationProgress) => void
  ): Promise<Blob> {
    const JSZip = await import('jszip')
    const zip = new JSZip.default()

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
}