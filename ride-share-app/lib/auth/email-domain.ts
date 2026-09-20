import 'server-only'

const DEFAULT_STUDENT_DOMAINS = [
  'students.finki.ukim.mk',
  'student.finki.ukim.mk',
]

export function allowedStudentDomains(): string[] {
  const configured = process.env.STUDENT_EMAIL_DOMAINS

  return (configured ? configured.split(',') : DEFAULT_STUDENT_DOMAINS)
    .map((domain) => domain.trim().toLocaleLowerCase('en-US'))
    .filter(Boolean)
}

export function isAllowedStudentEmail(email: string): boolean {
  const normalizedEmail = email.trim().toLocaleLowerCase('en-US')
  const separator = normalizedEmail.lastIndexOf('@')

  if (separator <= 0 || separator === normalizedEmail.length - 1) return false

  const domain = normalizedEmail.slice(separator + 1)
  return allowedStudentDomains().includes(domain)
}

