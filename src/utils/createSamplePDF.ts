import { PDFDocument, PDFForm, PDFTextField, PDFCheckBox, PDFDropdown, rgb, StandardFonts } from 'pdf-lib'

export async function createSamplePDFTemplate(): Promise<Uint8Array> {
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create()
  
  // Add a page
  const page = pdfDoc.addPage([612, 792]) // Standard letter size
  const { width, height } = page.getSize()
  
  // Get a font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  // Add title
  page.drawText('Employee Information Form', {
    x: 50,
    y: height - 50,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0),
  })
  
  // Add subtitle
  page.drawText('Please fill out all required fields', {
    x: 50,
    y: height - 80,
    size: 12,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  })
  
  // Get the form
  const form = pdfDoc.getForm()
  
  let yPosition = height - 120
  const leftMargin = 50
  const fieldHeight = 20
  const fieldWidth = 200
  const spacing = 40
  
  // Personal Information Section
  page.drawText('Personal Information', {
    x: leftMargin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 30
  
  // First Name field
  page.drawText('First Name *', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const firstNameField = form.createTextField('first_name')
  firstNameField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: fieldWidth,
    height: fieldHeight,
  })
  firstNameField.setText('')
  firstNameField.enableRequired()
  
  yPosition -= spacing
  
  // Last Name field
  page.drawText('Last Name *', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const lastNameField = form.createTextField('last_name')
  lastNameField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: fieldWidth,
    height: fieldHeight,
  })
  lastNameField.setText('')
  lastNameField.enableRequired()
  
  yPosition -= spacing
  
  // Email field
  page.drawText('Email Address *', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const emailField = form.createTextField('email')
  emailField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: fieldWidth,
    height: fieldHeight,
  })
  emailField.setText('')
  emailField.enableRequired()
  
  yPosition -= spacing
  
  // Phone field
  page.drawText('Phone Number', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const phoneField = form.createTextField('phone')
  phoneField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: fieldWidth,
    height: fieldHeight,
  })
  phoneField.setText('')
  
  yPosition -= spacing
  
  // Department dropdown
  page.drawText('Department *', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const departmentField = form.createDropdown('department')
  departmentField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: fieldWidth,
    height: fieldHeight,
  })
  departmentField.addOptions([
    'Engineering',
    'Marketing',
    'Sales',
    'Human Resources',
    'Finance',
    'Operations'
  ])
  departmentField.select('Engineering')
  
  yPosition -= spacing
  
  // Position field
  page.drawText('Position/Title', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const positionField = form.createTextField('position')
  positionField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: fieldWidth,
    height: fieldHeight,
  })
  positionField.setText('')
  
  yPosition -= spacing
  
  // Employment Status Section
  page.drawText('Employment Details', {
    x: leftMargin,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0),
  })
  yPosition -= 30
  
  // Start Date field
  page.drawText('Start Date', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const startDateField = form.createTextField('start_date')
  startDateField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: fieldWidth,
    height: fieldHeight,
  })
  startDateField.setText('')
  
  yPosition -= spacing
  
  // Salary field
  page.drawText('Annual Salary', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const salaryField = form.createTextField('salary')
  salaryField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: fieldWidth,
    height: fieldHeight,
  })
  salaryField.setText('')
  
  yPosition -= spacing
  
  // Full-time checkbox
  page.drawText('Employment Type:', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const fullTimeField = form.createCheckBox('full_time')
  fullTimeField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: 15,
    height: 15,
  })
  
  page.drawText('Full-time', {
    x: leftMargin + 140,
    y: yPosition + 2,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const partTimeField = form.createCheckBox('part_time')
  partTimeField.addToPage(page, {
    x: leftMargin + 200,
    y: yPosition,
    width: 15,
    height: 15,
  })
  
  page.drawText('Part-time', {
    x: leftMargin + 220,
    y: yPosition + 2,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  yPosition -= spacing
  
  // Remote work checkbox
  page.drawText('Work Arrangements:', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const remoteField = form.createCheckBox('remote_work')
  remoteField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: 15,
    height: 15,
  })
  
  page.drawText('Remote work eligible', {
    x: leftMargin + 140,
    y: yPosition + 2,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  yPosition -= spacing
  
  // Benefits checkbox
  const benefitsField = form.createCheckBox('benefits_eligible')
  benefitsField.addToPage(page, {
    x: leftMargin + 120,
    y: yPosition,
    width: 15,
    height: 15,
  })
  
  page.drawText('Benefits eligible', {
    x: leftMargin + 140,
    y: yPosition + 2,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  yPosition -= spacing * 1.5
  
  // Comments section
  page.drawText('Additional Comments:', {
    x: leftMargin,
    y: yPosition + 5,
    size: 10,
    font: font,
    color: rgb(0, 0, 0),
  })
  
  const commentsField = form.createTextField('comments')
  commentsField.addToPage(page, {
    x: leftMargin,
    y: yPosition - 60,
    width: fieldWidth * 2,
    height: 60,
  })
  commentsField.setText('')
  commentsField.enableMultiline()
  
  // Add footer
  page.drawText('* Required fields', {
    x: leftMargin,
    y: 50,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  })
  
  page.drawText('Generated by PDF Generator Application', {
    x: width - 200,
    y: 30,
    size: 8,
    font: font,
    color: rgb(0.7, 0.7, 0.7),
  })
  
  // Save the PDF
  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}