import { PDFDocument } from 'pdf-lib'

/**
 * Extracts field names from a PDF that might be using XFA (XML Forms Architecture)
 * This is a more advanced approach for PDFs that don't expose their fields through standard methods
 */
export async function extractXFAFormFields(pdfData: ArrayBuffer): Promise<string[]> {
  try {
    // Convert the PDF data to a string to search for field names
    const bytes = new Uint8Array(pdfData)
    let pdfText = ''
    for (let i = 0; i < Math.min(bytes.byteLength, 10000000); i++) { // Limit to first 10MB to avoid memory issues
      pdfText += String.fromCharCode(bytes[i])
    }
    
    // Look for field patterns in XFA forms
    const fieldNames: string[] = []
    
    // Pattern 1: Look for field names in XFA format
    const xfaFieldRegex = /<field\s+name="([^"]+)"/gi
    let match
    while ((match = xfaFieldRegex.exec(pdfText)) !== null) {
      fieldNames.push(match[1])
    }
    
    // Pattern 2: Look for field names in AcroForm format
    const acroFieldRegex = /\/T\s*\(([^)]+)\)/g
    while ((match = acroFieldRegex.exec(pdfText)) !== null) {
      fieldNames.push(match[1])
    }
    
    // Pattern 3: Look for field names in XFA datasets
    const xfaDatasetRegex = /<\w+:field\s+name="([^"]+)"/gi
    while ((match = xfaDatasetRegex.exec(pdfText)) !== null) {
      fieldNames.push(match[1])
    }
    
    // Pattern 4: Look for field names in XFA templates
    const xfaTemplateRegex = /<bind\s+match="([^"]+)"/gi
    while ((match = xfaTemplateRegex.exec(pdfText)) !== null) {
      fieldNames.push(match[1])
    }
    
    // Pattern 5: Look for field names in XFA bindings
    const xfaBindingRegex = /\bfield="([^"]+)"/gi
    while ((match = xfaBindingRegex.exec(pdfText)) !== null) {
      fieldNames.push(match[1])
    }
    
    // Pattern 6: Look for field names in XFA connections
    const xfaConnectionRegex = /\bconnection="([^"]+)"/gi
    while ((match = xfaConnectionRegex.exec(pdfText)) !== null) {
      fieldNames.push(match[1])
    }
    
    // Pattern 7: Look for field names in XFA subforms
    const xfaSubformRegex = /<subform\s+name="([^"]+)"/gi
    while ((match = xfaSubformRegex.exec(pdfText)) !== null) {
      fieldNames.push(match[1])
    }
    
    // Pattern 8: Look for field names in XFA exData
    const xfaExDataRegex = /<exData\s+name="([^"]+)"/gi
    while ((match = xfaExDataRegex.exec(pdfText)) !== null) {
      fieldNames.push(match[1])
    }
    
    // Return unique field names
    return [...new Set(fieldNames)]
  } catch (error) {
    console.error('Error extracting XFA form fields:', error)
    return []
  }
}

/**
 * Attempts to determine if a PDF is using XFA (XML Forms Architecture)
 */
export async function isPDFUsingXFA(pdfData: ArrayBuffer): Promise<boolean> {
  try {
    // Convert the PDF data to a string to search for XFA indicators
    const bytes = new Uint8Array(pdfData)
    let pdfText = ''
    for (let i = 0; i < Math.min(bytes.byteLength, 1000000); i++) { // Limit to first 1MB
      pdfText += String.fromCharCode(bytes[i])
    }
    
    // Check for XFA indicators
    return pdfText.includes('/XFA') || 
           pdfText.includes('<xfa:') || 
           pdfText.includes('<xdp:') ||
           pdfText.includes('<template xmlns:xfa')
  } catch (error) {
    console.error('Error checking for XFA:', error)
    return false
  }
}

/**
 * Extracts field names from a PDF using a deep scan approach
 * This is useful for PDFs where standard methods fail
 */
export async function deepScanPDFForFields(pdfData: ArrayBuffer): Promise<string[]> {
  try {
    // Convert the PDF data to a string
    const bytes = new Uint8Array(pdfData)
    let pdfText = ''
    for (let i = 0; i < Math.min(bytes.byteLength, 5000000); i++) { // Limit to first 5MB
      pdfText += String.fromCharCode(bytes[i])
    }
    
    const fieldNames: string[] = []
    
    // Look for various field patterns
    const patterns = [
      /\/T\s*\(([^)]+)\)/g,  // AcroForm field names
      /<field\s+name="([^"]+)"/gi,  // XFA field names
      /TU\s*\(([^)]+)\)/g,  // Tool tip (often contains field names)
      /\/V\s*\(([^)]+)\)/g,  // Field values (might indicate field names)
      /\/Ff\s+(\d+)/g,       // Field flags
      /\/FT\s+\/([A-Za-z]+)/g, // Field types
    ]
    
    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(pdfText)) !== null) {
        if (match[1]) {
          fieldNames.push(match[1])
        }
      }
    }
    
    // Return unique field names
    return [...new Set(fieldNames)]
  } catch (error) {
    console.error('Error deep scanning PDF for fields:', error)
    return []
  }
}

/**
 * Checks if a PDF has form elements even if field names can't be extracted
 */
export async function hasPDFFormElements(pdfData: ArrayBuffer): Promise<boolean> {
  try {
    // Convert the PDF data to a string
    const bytes = new Uint8Array(pdfData)
    let pdfText = ''
    for (let i = 0; i < Math.min(bytes.byteLength, 1000000); i++) { // Limit to first 1MB
      pdfText += String.fromCharCode(bytes[i])
    }
    
    // Check for form element indicators
    return pdfText.includes('/AcroForm') || 
           pdfText.includes('/Subtype/Form') || 
           pdfText.includes('/Subtype/Widget') ||
           pdfText.includes('/FT/Tx') ||  // Text field
           pdfText.includes('/FT/Btn') || // Button field (checkbox, radio)
           pdfText.includes('/FT/Ch') ||  // Choice field (dropdown, list)
           pdfText.includes('/XFA')       // XFA form
  } catch (error) {
    console.error('Error checking for form elements:', error)
    return false
  }
}