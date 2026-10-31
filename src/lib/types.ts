export type UserRole = 'admin' | 'student'

export type AttendanceStatus = 'present' | 'absent_excused' | 'absent_unexcused' | 'late'

export interface Profile {
  id: string
  username: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export interface Class {
  id: string
  name: string
  school_year: string
  description: string | null
  created_at: string
}

export interface StudentClass {
  id: string
  student_id: string
  class_id: string
  enrolled_at: string
  profiles?: Profile
  classes?: Class
}

export interface Session {
  id: string
  class_id: string
  subject: string
  date: string
  start_time: string
  end_time: string
  room: string | null
  notes: string | null
  created_at: string
  classes?: Class
  is_cancelled?: boolean
  cancel_reason?: string
}

// Helpers for checking and formatting cancelled / holiday sessions
export const SESSION_CANCELLED_PREFIX = '[LỚP NGHỈ]'

export function isSessionCancelled(session: { notes?: string | null } | null | undefined): boolean {
  if (!session || !session.notes) return false
  return session.notes.startsWith(SESSION_CANCELLED_PREFIX)
}

export function getSessionCancelReason(notes: string | null | undefined): string {
  if (!notes || !notes.startsWith(SESSION_CANCELLED_PREFIX)) return ''
  const trimmed = notes.slice(SESSION_CANCELLED_PREFIX.length).trim()
  if (trimmed.startsWith(':')) {
    return trimmed.slice(1).trim()
  }
  return trimmed
}

export function formatSessionNotes(isCancelled: boolean, reason: string, originalNotes: string = ''): string {
  const cleanOriginal = originalNotes.startsWith(SESSION_CANCELLED_PREFIX)
    ? ''
    : originalNotes.trim()
  if (!isCancelled) return cleanOriginal
  const prefix = reason ? `${SESSION_CANCELLED_PREFIX}: ${reason.trim()}` : SESSION_CANCELLED_PREFIX
  return cleanOriginal ? `${prefix} | ${cleanOriginal}` : prefix
}


export interface Attendance {
  id: string
  session_id: string
  student_id: string
  status: AttendanceStatus
  notes: string | null
  created_at: string
  updated_at: string
  profiles?: Profile
  sessions?: Session
}

export interface Assignment {
  id: string
  class_id: string
  title: string
  description: string | null
  due_date: string
  file_url: string | null
  file_name: string | null
  has_quiz: boolean
  show_answers: boolean
  created_at: string
  classes?: Class
  questions?: Question[]
}

export interface Question {
  id: string
  assignment_id: string
  question_number: number
  content: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
  points: number
  created_at: string
}

export interface Submission {
  id: string
  assignment_id: string
  student_id: string
  file_url: string | null
  file_name: string | null
  quiz_score: number | null
  manual_score: number | null
  feedback: string | null
  submitted_at: string
  graded_at: string | null
  profiles?: Profile
  assignments?: Assignment
  answers?: Answer[]
}

export interface Answer {
  id: string
  submission_id: string
  question_id: string
  selected_answer: 'A' | 'B' | 'C' | 'D' | null
  is_correct: boolean | null
  questions?: Question
}

export interface Setting {
  id: string
  key: string
  value: string
  updated_at: string
}

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: 'Có mặt',
  absent_excused: 'Vắng có phép',
  absent_unexcused: 'Vắng không phép',
  late: 'Đi muộn',
}

export const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  present: 'badge-present',
  absent_excused: 'badge-absent-excused',
  absent_unexcused: 'badge-absent-unexcused',
  late: 'badge-late',
}

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Chủ nhật' },
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
]
