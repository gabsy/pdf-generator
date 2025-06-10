export const sampleEmployeeData = [
  {
    first_name: "John",
    last_name: "Smith",
    email: "john.smith@company.com",
    phone: "(555) 123-4567",
    department: "Engineering",
    position: "Senior Software Engineer",
    start_date: "2023-01-15",
    salary: "95000",
    full_time: "true",
    part_time: "false",
    remote_work: "true",
    benefits_eligible: "true",
    comments: "Experienced developer with expertise in React and Node.js"
  },
  {
    first_name: "Sarah",
    last_name: "Johnson",
    email: "sarah.johnson@company.com",
    phone: "(555) 234-5678",
    department: "Marketing",
    position: "Marketing Manager",
    start_date: "2023-03-01",
    salary: "75000",
    full_time: "true",
    part_time: "false",
    remote_work: "false",
    benefits_eligible: "true",
    comments: "Creative marketing professional with 5+ years experience"
  },
  {
    first_name: "Michael",
    last_name: "Brown",
    email: "michael.brown@company.com",
    phone: "(555) 345-6789",
    department: "Sales",
    position: "Sales Representative",
    start_date: "2023-02-15",
    salary: "55000",
    full_time: "true",
    part_time: "false",
    remote_work: "true",
    benefits_eligible: "true",
    comments: "Motivated sales professional with strong communication skills"
  },
  {
    first_name: "Emily",
    last_name: "Davis",
    email: "emily.davis@company.com",
    phone: "(555) 456-7890",
    department: "Human Resources",
    position: "HR Coordinator",
    start_date: "2023-04-01",
    salary: "50000",
    full_time: "false",
    part_time: "true",
    remote_work: "false",
    benefits_eligible: "false",
    comments: "Part-time HR support with excellent organizational skills"
  },
  {
    first_name: "David",
    last_name: "Wilson",
    email: "david.wilson@company.com",
    phone: "(555) 567-8901",
    department: "Finance",
    position: "Financial Analyst",
    start_date: "2023-01-30",
    salary: "65000",
    full_time: "true",
    part_time: "false",
    remote_work: "true",
    benefits_eligible: "true",
    comments: "Detail-oriented analyst with CPA certification"
  }
]

export function generateSampleCSV(): string {
  const headers = Object.keys(sampleEmployeeData[0])
  const csvContent = [
    headers.join(','),
    ...sampleEmployeeData.map(row => 
      headers.map(header => `"${row[header as keyof typeof row]}"`).join(',')
    )
  ].join('\n')
  
  return csvContent
}

export function downloadSampleCSV(filename: string = 'sample_employee_data.csv') {
  const csvContent = generateSampleCSV()
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}