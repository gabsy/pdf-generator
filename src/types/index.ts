export interface Section {
  id: string
  name: string
  description: string
  createdAt: Date
  template?: PDFTemplate
  users: User[]
  fieldMappings: FieldMapping[]
  status: 'draft' | 'template-configured' | 'users-loaded' | 'ready'
}

export interface PDFTemplate {
  fileName: string
  fileData: ArrayBuffer
  extractedFields: PDFField[]
  uploadedAt: Date
  pageCount: number
}

export interface PDFField {
  name: string
  type: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'date' | 'number'
  required: boolean
  options?: string[]
  defaultValue?: string
}

export interface User {
  id: string
  [key: string]: any
}

export interface FieldMapping {
  pdfFieldName: string
  csvColumnName: string
  defaultValue?: string
  isRequired: boolean
}

export interface GenerationProgress {
  current: number
  total: number
  status: 'idle' | 'processing' | 'completed' | 'error'
  error?: string
}

export interface CSVParseResult {
  data: any[]
  headers: string[]
  errors: any[]
}

export interface UserProfile {
  id: string
  email: string
  role: 'admin' | 'user'
  createdAt: Date
  updatedAt: Date
  createdBy?: string
}