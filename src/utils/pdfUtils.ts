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
    
    // Enhanced patterns for better field detection
    const patterns = [
      // XFA field patterns
      /<field\s+name="([^"]+)"/gi,
      /<field\s+name='([^']+)'/gi,
      /<\w+:field\s+name="([^"]+)"/gi,
      
      // AcroForm patterns
      /\/T\s*\(([^)]+)\)/g,
      /\/TU\s*\(([^)]+)\)/g,
      
      // XFA binding patterns
      /<bind\s+ref="([^"]+)"/gi,
      /<bind\s+match="([^"]+)"/gi,
      
      // XFA data patterns
      /\$record\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      /\$data\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      
      // Form calculation patterns
      /this\.getField\("([^"]+)"\)/g,
      /this\.getField\('([^']+)'\)/g,
      
      // Widget annotation patterns
      /\/Subtype\s*\/Widget.*?\/T\s*\(([^)]+)\)/gs,
      
      // XFA template patterns
      /<subform\s+name="([^"]+)"/gi,
      /<exclGroup\s+name="([^"]+)"/gi,
      
      // Alternative field reference patterns
      /field\["([^"]+)"\]/g,
      /field\['([^']+)'\]/g,
      
      // XFA connection patterns
      /\bconnection="([^"]+)"/gi,
      
      // Form field dictionary patterns
      /\/FT\s*\/\w+.*?\/T\s*\(([^)]+)\)/gs,
    ]
    
    for (const pattern of patterns) {
      let match
      pattern.lastIndex = 0 // Reset regex state
      
      while ((match = pattern.exec(pdfText)) !== null) {
        if (match[1]) {
          const fieldName = match[1].trim()
          
          // Validate field name
          if (isValidFieldName(fieldName)) {
            fieldNames.push(fieldName)
          }
        }
      }
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
    const xfaIndicators = [
      '/XFA',
      '<xfa:',
      '<xdp:',
      '<template xmlns:xfa',
      'application/vnd.adobe.xdp+xml',
      'XFA_',
      'xfa.form',
      'xfa.datasets',
      'xfa.template'
    ]
    
    return xfaIndicators.some(indicator => pdfText.includes(indicator))
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
    
    // Comprehensive patterns for field detection
    const patterns = [
      // Standard AcroForm patterns
      /\/T\s*\(([^)]+)\)/g,
      /\/TU\s*\(([^)]+)\)/g,
      /\/V\s*\(([^)]+)\)/g,
      
      // XFA patterns
      /<field\s+name="([^"]+)"/gi,
      /<field\s+name='([^']+)'/gi,
      /<\w+:field\s+name="([^"]+)"/gi,
      
      // Widget annotations
      /\/Subtype\s*\/Widget.*?\/T\s*\(([^)]+)\)/gs,
      
      // Form field dictionaries
      /\/FT\s*\/\w+.*?\/T\s*\(([^)]+)\)/gs,
      
      // JavaScript field references
      /this\.getField\("([^"]+)"\)/g,
      /this\.getField\('([^']+)'\)/g,
      /event\.target\.name\s*==\s*"([^"]+)"/g,
      
      // XFA binding and data patterns
      /<bind\s+ref="([^"]+)"/gi,
      /<bind\s+match="([^"]+)"/gi,
      /\$record\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      /\$data\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      
      // Alternative field reference patterns
      /field\["([^"]+)"\]/g,
      /field\['([^']+)'\]/g,
      /getField\("([^"]+)"\)/g,
      
      // Form calculation patterns
      /calc\s*=\s*"([^"]+)"/gi,
      /validate\s*=\s*"([^"]+)"/gi,
      
      // XFA subform patterns
      /<subform\s+name="([^"]+)"/gi,
      /<exclGroup\s+name="([^"]+)"/gi,
      
      // Data connection patterns
      /\bconnection="([^"]+)"/gi,
      /\bdataNode="([^"]+)"/gi,
    ]
    
    for (const pattern of patterns) {
      let match
      pattern.lastIndex = 0
      
      while ((match = pattern.exec(pdfText)) !== null) {
        if (match[1]) {
          const fieldName = match[1].trim()
          
          if (isValidFieldName(fieldName)) {
            fieldNames.push(fieldName)
          }
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
    const formIndicators = [
      '/AcroForm',
      '/Subtype/Form',
      '/Subtype/Widget',
      '/FT/Tx',  // Text field
      '/FT/Btn', // Button field (checkbox, radio)
      '/FT/Ch',  // Choice field (dropdown, list)
      '/XFA',    // XFA form
      'application/vnd.adobe.xdp+xml',
      '<xfa:',
      '<xdp:',
      '<template',
      '<field',
      'xfa.form',
      'xfa.datasets'
    ]
    
    return formIndicators.some(indicator => pdfText.includes(indicator))
  } catch (error) {
    console.error('Error checking for form elements:', error)
    return false
  }
}

/**
 * Helper function to validate field names
 */
function isValidFieldName(name: string): boolean {
  // Filter out common non-field strings
  const invalidPatterns = [
    /^(form|data|template|subform|exData|bind|xfa|pdf|page|document|root|datasets|config)$/i,
    /^[0-9]+$/,  // Pure numbers
    /^\s*$/,     // Empty or whitespace
    /[<>{}[\]]/,  // Contains XML/JSON brackets
    /^(true|false|null|undefined|yes|no)$/i,  // Boolean/null values
    /^(http|https|ftp|file):/i,  // URLs
    /\.(pdf|xml|html|js|css|xdp|xfa)$/i,  // File extensions
    /^(xmlns|version|encoding|standalone)$/i,  // XML attributes
    /^(adobe|acrobat|reader|designer)$/i,  // Software names
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
  
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(name)) {
    return false
  }
  
  return true
}