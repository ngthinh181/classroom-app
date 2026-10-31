import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns'
import type { Class, Session } from './types'

export interface FixedScheduleSlot {
  id: string
  day_of_week: number // 1: Thứ 2, 2: Thứ 3, 3: Thứ 4, 4: Thứ 5, 5: Thứ 6, 6: Thứ 7, 0: Chủ nhật
  start_time: string  // '19:00'
  end_time: string    // '20:30'
  subject: string     // 'Toán'
  room?: string       // 'Phòng 101'
  notes?: string
}

export interface DisbandInfo {
  is_disbanded: boolean
  disbanded_at?: string
  reason?: string
}

const SCHEDULE_TAG_START = '<!--SCHEDULE:'
const SCHEDULE_TAG_END = '-->'
const DISBAND_TAG_START = '<!--DISBANDED:'
const DISBAND_TAG_END = '-->'

/**
 * Extract clean description text without hidden metadata tags
 */
export function getCleanDescription(desc: string | null | undefined): string {
  if (!desc) return ''
  let cleaned = desc
  cleaned = cleaned.replace(/<!--SCHEDULE:[\s\S]*?-->/g, '')
  cleaned = cleaned.replace(/<!--DISBANDED:[\s\S]*?-->/g, '')
  return cleaned.trim()
}

/**
 * Extract fixed weekly schedule slots from class description
 */
export function getFixedSchedule(desc: string | null | undefined): FixedScheduleSlot[] {
  if (!desc) return []
  const startIdx = desc.indexOf(SCHEDULE_TAG_START)
  if (startIdx === -1) return []
  const endIdx = desc.indexOf(SCHEDULE_TAG_END, startIdx)
  if (endIdx === -1) return []

  try {
    const jsonStr = desc.substring(startIdx + SCHEDULE_TAG_START.length, endIdx)
    const parsed = JSON.parse(jsonStr)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('Failed to parse fixed schedule:', err)
    return []
  }
}

/**
 * Encode fixed schedule slots into class description while preserving text and disband tags
 */
export function encodeFixedSchedule(existingDesc: string | null | undefined, slots: FixedScheduleSlot[]): string {
  const clean = getCleanDescription(existingDesc)
  const disbandInfo = getDisbandInfo(existingDesc)
  
  let result = clean
  if (slots.length > 0) {
    result += (result ? '\n' : '') + `${SCHEDULE_TAG_START}${JSON.stringify(slots)}${SCHEDULE_TAG_END}`
  }
  if (disbandInfo.is_disbanded) {
    result += (result ? '\n' : '') + `${DISBAND_TAG_START}${JSON.stringify(disbandInfo)}${DISBAND_TAG_END}`
  }
  return result
}

/**
 * Extract disband info from class description or name
 */
export function getDisbandInfo(desc: string | null | undefined, name?: string): DisbandInfo {
  if (name && (name.startsWith('[ĐÃ GIẢI TÁN]') || name.startsWith('[TỐT NGHIỆP]'))) {
    return { is_disbanded: true, reason: 'Lớp đã giải tán / tốt nghiệp' }
  }
  if (!desc) return { is_disbanded: false }

  const startIdx = desc.indexOf(DISBAND_TAG_START)
  if (startIdx === -1) {
    if (desc.includes('[ĐÃ GIẢI TÁN]') || desc.includes('[TỐT NGHIỆP]')) {
      return { is_disbanded: true, reason: 'Lớp đã giải tán' }
    }
    return { is_disbanded: false }
  }

  const endIdx = desc.indexOf(DISBAND_TAG_END, startIdx)
  if (endIdx === -1) return { is_disbanded: true }

  try {
    const jsonStr = desc.substring(startIdx + DISBAND_TAG_START.length, endIdx)
    return JSON.parse(jsonStr)
  } catch {
    return { is_disbanded: true }
  }
}

/**
 * Encode disband info into class description
 */
export function encodeDisbandInfo(
  existingDesc: string | null | undefined,
  info: DisbandInfo
): string {
  const clean = getCleanDescription(existingDesc)
  const scheduleSlots = getFixedSchedule(existingDesc)

  let result = clean
  if (scheduleSlots.length > 0) {
    result += (result ? '\n' : '') + `${SCHEDULE_TAG_START}${JSON.stringify(scheduleSlots)}${SCHEDULE_TAG_END}`
  }
  if (info.is_disbanded) {
    result += (result ? '\n' : '') + `${DISBAND_TAG_START}${JSON.stringify(info)}${DISBAND_TAG_END}`
  }
  return result
}

/**
 * Generate sessions from a fixed schedule for a given number of weeks (e.g. 16 - 24 weeks)
 * Skips dates where a session already exists to avoid duplicates or overwriting custom changes.
 */
export function generateSessionsFromSchedule(
  classId: string,
  slots: FixedScheduleSlot[],
  startDate: Date,
  weeksCount: number = 16,
  existingSessions: { date: string; start_time: string; class_id: string }[] = []
): {
  class_id: string
  subject: string
  date: string
  start_time: string
  end_time: string
  room?: string
  notes?: string
}[] {
  if (!slots || slots.length === 0) return []

  // Align start to beginning of the week (Monday)
  const baseMonday = startOfWeek(startDate, { weekStartsOn: 1 })
  const newSessions: {
    class_id: string
    subject: string
    date: string
    start_time: string
    end_time: string
    room?: string
    notes?: string
  }[] = []

  // Create lookup set for existing sessions
  const existingSet = new Set(
    existingSessions
      .filter(s => s.class_id === classId)
      .map(s => `${s.date}_${s.start_time.slice(0, 5)}`)
  )

  for (let week = 0; week < weeksCount; week++) {
    const currentWeekMonday = addDays(baseMonday, week * 7)

    for (const slot of slots) {
      // Calculate day offset from Monday:
      // slot.day_of_week: 1 (Mon) -> offset 0
      // 2 (Tue) -> offset 1, ..., 6 (Sat) -> offset 5, 0 (Sun) -> offset 6
      const offset = slot.day_of_week === 0 ? 6 : slot.day_of_week - 1
      const sessionDate = addDays(currentWeekMonday, offset)
      const dateStr = format(sessionDate, 'yyyy-MM-dd')
      const startTimeShort = slot.start_time.slice(0, 5)

      const key = `${dateStr}_${startTimeShort}`
      if (!existingSet.has(key)) {
        newSessions.push({
          class_id: classId,
          subject: slot.subject,
          date: dateStr,
          start_time: slot.start_time,
          end_time: slot.end_time,
          room: slot.room || '',
          notes: slot.notes || '',
        })
        // Add to existingSet to prevent internal duplicates if slots overlap
        existingSet.add(key)
      }
    }
  }

  return newSessions
}
