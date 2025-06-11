import { PDFDocument } from 'pdf-lib'

/**
 * Extracts field names from a PDF that might be using XFA (XML Forms Architecture)
 * This is a more advanced approach for PDFs that don't expose their fields through standard methods
 */
export async function extractXFAFormFields(pdfData: ArrayBuffer): Promise<string[]> {
  try {
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfData)
    
    // Get the document catalog
    const catalog = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Root)
    if (!catalog) return []
    
    // Try to find the XFA entry in the AcroForm dictionary
    const acroForm = catalog.get(PDFDocument.context.obj('AcroForm'))
    if (!acroForm) return []
    
    // Extract the XFA data if it exists
    const xfa = acroForm.get(PDFDocument.context.obj('XFA'))
    if (!xfa) return []
    
    // Convert the PDF data to a string to search for field names
    const bytes = new Uint8Array(pdfData)
    let pdfText = ''
    for (let i = 0; i < Math.min(bytes.byteLength, 10000000); i++) { // Limit to first 10MB to avoid memory issues
      pdfText += String.fromCharCode(bytes[i])
    }
    
    // Look for field patterns in XFA forms
    // This is a simplified approach - real XFA parsing would require XML parsing
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