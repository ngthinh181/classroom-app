'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addWeeks, subWeeks, addMonths, subMonths, parseISO
} from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  BarChart3, Download, AlertTriangle, Users, TrendingUp,
  Calendar, Clock, Filter, Hash, ChevronLeft, ChevronRight,
  Layers, CheckCircle2, ArrowRight, Search, CheckSquare, Square,
  Eye, Copy, Share2, X, FileText, Send, UserCheck, UserX, MessageSquare
} from 'lucide-react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { Class, Profile } from '@/lib/types'
import toast from 'react-hot-toast'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, ArcElement)

type FilterMode = 'all' | 'week' | 'month' | 'sessions' | 'custom'

interface StudentSessionDetail {
  session_id: string
  date: string
  subject: string
  start_time: string
  room?: string
  status: 'present' | 'late' | 'absent_excused' | 'absent_unexcused' | 'unrecorded'
  notes?: string
}

interface StudentStatItem extends Profile {
  total: number
  recorded: number
  present: number
  late: number
  excused: number
  unexcused: number
  absent_total: number
  rate: number
  warning: boolean
  sessionHistory: StudentSessionDetail[]
  absentDates: StudentSessionDetail[]
}

export default function StatsPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [tab, setTab] = useState<'attendance' | 'students' | 'assignments'>('attendance')

  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [weekOffset, setWeekOffset] = useState<number>(0)
  const [monthOffset, setMonthOffset] = useState<number>(0)
  const [sessionLimit, setSessionLimit] = useState<number>(5)
  const [customFromDate, setCustomFromDate] = useState<string>(() => format(subWeeks(new Date(), 2), 'yyyy-MM-dd'))
  const [customToDate, setCustomToDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'))

  // Filter summary
  const [filterSummaryLabel, setFilterSummaryLabel] = useState<string>('Toàn bộ thời gian')
  const [totalSessionsInPeriod, setTotalSessionsInPeriod] = useState<number>(0)

  // Data states
  const [attendanceStats, setAttendanceStats] = useState<any>(null)
  const [studentStats, setStudentStats] = useState<StudentStatItem[]>([])
  const [assignmentStats, setAssignmentStats] = useState<any[]>([])
  const [warningThreshold, setWarningThreshold] = useState(3)
  const [loading, setLoading] = useState(true)

  // Student Tab Specific States (Selection, Search, Filter)
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  const [studentSearch, setStudentSearch] = useState('')
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'absent' | 'warning' | 'selected'>('all')

  // Modals
  const [viewingStudent, setViewingStudent] = useState<StudentStatItem | null>(null)
  const [showZaloReportModal, setShowZaloReportModal] = useState(false)
  const [zaloReportText, setZaloReportText] = useState('')

  useEffect(() => {
    loadClasses()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      loadStats()
      setSelectedStudentIds(new Set())
    }
  }, [selectedClass, tab, filterMode, weekOffset, monthOffset, sessionLimit, customFromDate, customToDate])

  const currentClassName = classes.find(c => c.id === selectedClass)?.name || 'Lớp học'

  async function loadClasses() {
    const supabase = createClient()
    const [classesRes, settingsRes] = await Promise.all([
      supabase.from('classes').select('*').order('name'),
      supabase.from('settings').select('*').eq('key', 'absence_warning_threshold').maybeSingle()
    ])

    const data = classesRes.data || []
    setClasses(data)
    if (data.length > 0) {
      setSelectedClass(data[0].id)
    }
    if (settingsRes.data) {
      setWarningThreshold(parseInt(settingsRes.data.value))
    }
    setLoading(false)
  }

  async function loadStats() {
    const supabase = createClient()

    // 1. Determine filtered sessions based on filterMode
    let sessions: any[] = []
    let label = 'Toàn bộ thời gian'

    if (filterMode === 'all') {
      const { data } = await supabase
        .from('sessions')
        .select('id, date, subject, start_time, room')
        .eq('class_id', selectedClass)
        .order('date', { ascending: true })
      sessions = data || []
      label = 'Toàn bộ các buổi học'
    } else if (filterMode === 'week') {
      const targetDate = addWeeks(new Date(), weekOffset)
      const wStart = startOfWeek(targetDate, { weekStartsOn: 1 })
      const wEnd = endOfWeek(targetDate, { weekStartsOn: 1 })
      const fromStr = format(wStart, 'yyyy-MM-dd')
      const toStr = format(wEnd, 'yyyy-MM-dd')

      const { data } = await supabase
        .from('sessions')
        .select('id, date, subject, start_time, room')
        .eq('class_id', selectedClass)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: true })
      sessions = data || []

      const weekLabel = weekOffset === 0 ? 'Tuần này' : weekOffset === -1 ? 'Tuần trước' : `Tuần ${format(wStart, 'dd/MM')}`
      label = `${weekLabel} (${format(wStart, 'dd/MM')} - ${format(wEnd, 'dd/MM/yyyy')})`
    } else if (filterMode === 'month') {
      const targetDate = addMonths(new Date(), monthOffset)
      const mStart = startOfMonth(targetDate)
      const mEnd = endOfMonth(targetDate)
      const fromStr = format(mStart, 'yyyy-MM-dd')
      const toStr = format(mEnd, 'yyyy-MM-dd')

      const { data } = await supabase
        .from('sessions')
        .select('id, date, subject, start_time, room')
        .eq('class_id', selectedClass)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: true })
      sessions = data || []

      const monthLabel = monthOffset === 0 ? 'Tháng này' : monthOffset === -1 ? 'Tháng trước' : `Tháng ${format(targetDate, 'MM/yyyy')}`
      label = `${monthLabel} (Tháng ${format(targetDate, 'MM/yyyy')})`
    } else if (filterMode === 'sessions') {
      const { data } = await supabase
        .from('sessions')
        .select('id, date, subject, start_time, room')
        .eq('class_id', selectedClass)
        .order('date', { ascending: false })
        .limit(sessionLimit)
      sessions = (data || []).reverse()
      label = `${sessionLimit} buổi học gần nhất`
    } else if (filterMode === 'custom') {
      const fromStr = customFromDate || '1970-01-01'
      const toStr = customToDate || '2099-12-31'

      const { data } = await supabase
        .from('sessions')
        .select('id, date, subject, start_time, room')
        .eq('class_id', selectedClass)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: true })
      sessions = data || []
      label = `Từ ${format(new Date(fromStr), 'dd/MM/yyyy')} đến ${format(new Date(toStr), 'dd/MM/yyyy')}`
    }

    setFilterSummaryLabel(label)
    setTotalSessionsInPeriod(sessions.length)

    const sessionIds = sessions.map(s => s.id)

    // 2. Load tab specific statistics
    if (tab === 'attendance') {
      if (sessionIds.length === 0) {
        setAttendanceStats({})
        return
      }

      const { data: attendance } = await supabase
        .from('attendance')
        .select('session_id, status, sessions!inner(class_id, date, subject)')
        .in('session_id', sessionIds)

      const useDailyGrouping = filterMode === 'sessions' || sessions.length <= 8
      const groupedData: Record<string, { present: number; absent: number; late: number; total: number; title?: string }> = {}

      if (useDailyGrouping) {
        sessions.forEach(sess => {
          const key = `${format(new Date(sess.date), 'dd/MM')}`
          groupedData[key] = { present: 0, absent: 0, late: 0, total: 0, title: sess.subject }
        })

        attendance?.forEach((a: any) => {
          const key = `${format(new Date(a.sessions.date), 'dd/MM')}`
          if (!groupedData[key]) {
            groupedData[key] = { present: 0, absent: 0, late: 0, total: 0 }
          }
          groupedData[key].total++
          if (a.status === 'present') groupedData[key].present++
          else if (a.status === 'late') groupedData[key].late++
          else groupedData[key].absent++
        })
      } else {
        attendance?.forEach((a: any) => {
          const weekStart = format(startOfWeek(new Date(a.sessions.date), { weekStartsOn: 1 }), 'dd/MM')
          if (!groupedData[weekStart]) groupedData[weekStart] = { present: 0, absent: 0, late: 0, total: 0 }
          groupedData[weekStart].total++
          if (a.status === 'present') groupedData[weekStart].present++
          else if (a.status === 'late') groupedData[weekStart].late++
          else groupedData[weekStart].absent++
        })
      }

      setAttendanceStats(groupedData)
    }

    if (tab === 'students') {
      const [scRes, attRes] = await Promise.all([
        supabase
          .from('students_classes')
          .select('student_id, profiles(id, full_name, username)')
          .eq('class_id', selectedClass),
        sessionIds.length > 0
          ? supabase
              .from('attendance')
              .select('student_id, status, session_id, notes')
              .in('session_id', sessionIds)
          : Promise.resolve({ data: [] })
      ])

      const sc = scRes.data || []
      const attendance = (attRes.data as any[]) || []
      const totalSessions = sessions.length

      const stats: StudentStatItem[] = sc.map((s: any) => {
        const studentAtt = attendance.filter((a: any) => a.student_id === s.student_id)
        const present = studentAtt.filter((a: any) => a.status === 'present').length
        const late = studentAtt.filter((a: any) => a.status === 'late').length
        const excused = studentAtt.filter((a: any) => a.status === 'absent_excused').length
        const unexcused = studentAtt.filter((a: any) => a.status === 'absent_unexcused').length
        const absentTotal = excused + unexcused

        const rate = totalSessions > 0
          ? Math.round(((present + late * 0.5) / totalSessions) * 100)
          : 100

        // Build detailed history for each session in period
        const sessionHistory: StudentSessionDetail[] = sessions.map(sess => {
          const att = studentAtt.find((a: any) => a.session_id === sess.id)
          return {
            session_id: sess.id,
            date: sess.date,
            subject: sess.subject,
            start_time: sess.start_time,
            room: sess.room,
            status: att ? att.status : 'unrecorded',
            notes: att?.notes || '',
          }
        })

        const absentDates = sessionHistory.filter(sh => sh.status === 'absent_excused' || sh.status === 'absent_unexcused')

        return {
          ...s.profiles,
          total: totalSessions,
          recorded: studentAtt.length,
          present,
          late,
          excused,
          unexcused,
          absent_total: absentTotal,
          rate,
          warning: unexcused >= warningThreshold,
          sessionHistory,
          absentDates,
        }
      }).sort((a: any, b: any) => b.absent_total - a.absent_total)

      setStudentStats(stats)
    }

    if (tab === 'assignments') {
      let query = supabase
        .from('assignments')
        .select('id, title, due_date, has_quiz')
        .eq('class_id', selectedClass)
        .order('due_date', { ascending: false })

      if (filterMode === 'custom' && customFromDate && customToDate) {
        query = query.gte('due_date', customFromDate).lte('due_date', `${customToDate} 23:59:59`)
      } else if (filterMode === 'month') {
        const targetDate = addMonths(new Date(), monthOffset)
        const mStart = format(startOfMonth(targetDate), 'yyyy-MM-dd')
        const mEnd = format(endOfMonth(targetDate), 'yyyy-MM-dd')
        query = query.gte('due_date', mStart).lte('due_date', `${mEnd} 23:59:59`)
      } else if (filterMode === 'week') {
        const targetDate = addWeeks(new Date(), weekOffset)
        const wStart = format(startOfWeek(targetDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        const wEnd = format(endOfWeek(targetDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        query = query.gte('due_date', wStart).lte('due_date', `${wEnd} 23:59:59`)
      }

      const [assignmentsRes, scRes] = await Promise.all([
        query,
        supabase.from('students_classes').select('student_id').eq('class_id', selectedClass)
      ])

      const assignments = assignmentsRes.data || []
      const totalStudents = scRes.data?.length || 0
      const assignmentIds = assignments.map((a: any) => a.id)

      let allSubmissions: any[] = []
      if (assignmentIds.length > 0) {
        const { data: subs } = await supabase
          .from('submissions')
          .select('assignment_id, quiz_score, manual_score')
          .in('assignment_id', assignmentIds)
        allSubmissions = subs || []
      }

      const subsByAssignment = new Map<string, any[]>()
      for (const s of allSubmissions) {
        if (!subsByAssignment.has(s.assignment_id)) subsByAssignment.set(s.assignment_id, [])
        subsByAssignment.get(s.assignment_id)!.push(s)
      }

      const stats = assignments.map((a: any) => {
        const subs = subsByAssignment.get(a.id) || []
        const count = subs.length
        const validQuizSubs = subs.filter(s => s.quiz_score !== null)
        const avgQuiz = validQuizSubs.length > 0 ? validQuizSubs.reduce((sum, s) => sum + (s.quiz_score || 0), 0) / validQuizSubs.length : 0

        const validManualSubs = subs.filter(s => s.manual_score !== null)
        const avgManual = validManualSubs.length > 0 ? validManualSubs.reduce((sum, s) => sum + (s.manual_score || 0), 0) / validManualSubs.length : 0
        return {
          ...a,
          submitted: count,
          total: totalStudents,
          rate: totalStudents ? ((count / totalStudents) * 100).toFixed(0) : 0,
          avgQuiz: validQuizSubs.length > 0 ? avgQuiz.toFixed(1) : '-',
          avgManual: validManualSubs.length > 0 ? avgManual.toFixed(1) : '-',
        }
      })
      setAssignmentStats(stats)
    }
  }

  // Filtered students for display based on search & pill filter
  const displayedStudents = useMemo(() => {
    return studentStats.filter(s => {
      // Search term
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase()
        const matchName = s.full_name?.toLowerCase().includes(q)
        const matchUser = s.username?.toLowerCase().includes(q)
        if (!matchName && !matchUser) return false
      }
      // Status filter
      if (studentStatusFilter === 'absent') {
        return s.absent_total > 0
      }
      if (studentStatusFilter === 'warning') {
        return s.warning
      }
      if (studentStatusFilter === 'selected') {
        return selectedStudentIds.has(s.id)
      }
      return true
    })
  }, [studentStats, studentSearch, studentStatusFilter, selectedStudentIds])

  // Checkbox handlers
  function toggleSelectAll() {
    if (selectedStudentIds.size === displayedStudents.length && displayedStudents.length > 0) {
      setSelectedStudentIds(new Set())
    } else {
      setSelectedStudentIds(new Set(displayedStudents.map(s => s.id)))
    }
  }

  function toggleSelectStudent(id: string) {
    const next = new Set(selectedStudentIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedStudentIds(next)
  }

  // Export to Excel (supports all or selected students)
  async function exportToExcel() {
    const XLSX = await import('xlsx')
    let data: any[] = []
    let filename = `thong_ke_${filterMode}`

    if (tab === 'students') {
      const targetList = selectedStudentIds.size > 0
        ? studentStats.filter(s => selectedStudentIds.has(s.id))
        : studentStats

      data = targetList.map((s, i) => {
        const absentSummary = s.absentDates.map(ad =>
          `${format(new Date(ad.date), 'dd/MM')} (${ad.status === 'absent_excused' ? 'Có phép' : 'Không phép'})`
        ).join(', ')

        return {
          'STT': i + 1,
          'Họ tên': s.full_name,
          'Tên đăng nhập': s.username,
          'Có mặt': s.present,
          'Đi muộn': s.late,
          'Vắng có phép': s.excused,
          'Vắng không phép': s.unexcused,
          'Tổng buổi trong kỳ': s.total,
          'Tỉ lệ đi học (%)': `${s.rate}%`,
          'Các ngày nghỉ': absentSummary || 'Đi học đủ',
          'Cảnh báo': s.warning ? 'CẢNH BÁO' : '',
        }
      })
      filename = `chuyen_can_${currentClassName}_${filterMode}`
    } else if (tab === 'assignments') {
      data = assignmentStats.map((a, i) => ({
        'STT': i + 1,
        'Bài tập': a.title,
        'Đã nộp': a.submitted,
        'Tổng HS': a.total,
        'Tỉ lệ nộp (%)': `${a.rate}%`,
        'TB trắc nghiệm': a.avgQuiz,
        'TB điểm tay': a.avgManual,
      }))
      filename = `bai_tap_${currentClassName}_${filterMode}`
    }

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Thống kê')
    XLSX.writeFile(wb, `${filename}.xlsx`)
    toast.success('Đã xuất file Excel thành công')
  }

  // Generate Zalo message for a single student
  function generateStudentZaloReport(s: StudentStatItem): string {
    const absentList = s.absentDates.map(a =>
      `• ${format(new Date(a.date), 'dd/MM/yyyy')} (${a.subject || 'Học tập'}): ${a.status === 'absent_excused' ? 'Nghỉ có phép' : 'Nghỉ không phép'}${a.notes ? ` - ${a.notes}` : ''}`
    ).join('\n')

    return `📚 BÁO CÁO CHUYÊN CẦN HỌC TẬP
Học sinh: ${s.full_name} (${currentClassName})
Giai đoạn: ${filterSummaryLabel} (Tổng ${s.total} buổi học)
──────────────────
✅ Có mặt: ${s.present} buổi
⏰ Đi muộn: ${s.late} buổi
❌ Vắng mặt: ${s.absent_total} buổi (Có phép: ${s.excused}, Không phép: ${s.unexcused})
📊 Tỉ lệ đi học: ${s.rate}%

${s.absentDates.length > 0 ? `📌 CHI TIẾT CÁC NGÀY NGHỈ:\n${absentList}\n` : '🌟 Em đi học đầy đủ tất cả các buổi!\n'}
${s.warning ? '⚠️ Lưu ý: Em đã nghỉ không phép ≥ ' + warningThreshold + ' buổi. Phụ huynh vui lòng liên hệ giáo viên để phối hợp nhắc nhở em nhé!\n' : ''}──────────────────
Trân trọng gửi quý Phụ huynh!`
  }

  // Generate Group Zalo Report for selected students or whole class
  function generateGroupZaloReport(): string {
    const targetList = selectedStudentIds.size > 0
      ? studentStats.filter(s => selectedStudentIds.has(s.id))
      : studentStats

    const absentStudents = targetList.filter(s => s.absent_total > 0)
    const fullAttendance = targetList.filter(s => s.absent_total === 0)

    let report = `📢 BÁO CÁO CHUYÊN CẦN LỚP ${currentClassName.toUpperCase()}
🗓️ Giai đoạn: ${filterSummaryLabel}
📊 Tổng số buổi học: ${totalSessionsInPeriod} buổi
👥 Tổng số học sinh: ${targetList.length} em
──────────────────
`

    if (absentStudents.length > 0) {
      report += `❌ DANH SÁCH HỌC SINH CÓ NGHỈ HỌC (${absentStudents.length} em):\n`
      absentStudents.forEach((s, idx) => {
        const dates = s.absentDates.map(d =>
          `${format(new Date(d.date), 'dd/MM')} (${d.status === 'absent_excused' ? 'CP' : 'KP'})`
        ).join(', ')
        report += `${idx + 1}. ${s.full_name}: Nghỉ ${s.absent_total} buổi [${dates}]\n`
      })
      report += `──────────────────\n`
    }

    if (fullAttendance.length > 0) {
      report += `🌟 TUYÊN DƯƠNG ĐI HỌC ĐỦ 100% (${fullAttendance.length} em):\n`
      report += fullAttendance.map(s => s.full_name).join(', ') + '\n'
      report += `──────────────────\n`
    }

    report += `👉 Phụ huynh và học sinh có thể theo dõi chi tiết lịch học và bài tập tại:
https://classroom-web-app-eight.vercel.app`

    return report
  }

  function handleOpenGroupZaloReport() {
    const text = generateGroupZaloReport()
    setZaloReportText(text)
    setShowZaloReportModal(true)
  }

  function copyTextToClipboard(text: string, successMsg = 'Đã sao chép vào bộ nhớ tạm') {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(successMsg)
    }).catch(() => {
      toast.error('Không thể tự động sao chép. Hãy bôi đen văn bản để copy.')
    })
  }

  const chartData = attendanceStats && Object.keys(attendanceStats).length > 0 ? {
    labels: Object.keys(attendanceStats),
    datasets: [
      { label: 'Có mặt', data: Object.values(attendanceStats).map((w: any) => w.present), backgroundColor: '#34d399', borderRadius: 6 },
      { label: 'Đi muộn', data: Object.values(attendanceStats).map((w: any) => w.late), backgroundColor: '#fbbf24', borderRadius: 6 },
      { label: 'Vắng', data: Object.values(attendanceStats).map((w: any) => w.absent), backgroundColor: '#f87171', borderRadius: 6 },
    ]
  } : null

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>
            Thống kê & Báo cáo
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Phân tích dữ liệu chuyên cần, tỉ lệ đi học, chi tiết ngày nghỉ và kết quả bài tập theo nhiều mốc thời gian.
          </p>
        </div>

        {selectedClass && (
          <div style={{ display: 'flex', gap: '10px' }}>
            {tab === 'students' && (
              <button
                className="btn btn-primary"
                onClick={handleOpenGroupZaloReport}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px',
                  background: '#0068ff', border: 'none'
                }}
              >
                <MessageSquare size={16} /> Báo cáo Zalo nhóm
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={exportToExcel}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
            >
              <Download size={15} />
              {tab === 'students' && selectedStudentIds.size > 0
                ? `Xuất Excel (${selectedStudentIds.size} HS)`
                : 'Xuất Excel'}
            </button>
          </div>
        )}
      </div>

      {/* Class Selection & Main Tabs */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '14px', marginBottom: '16px'
      }}>
        <select
          className="input"
          style={{ maxWidth: '280px', fontWeight: '600' }}
          value={selectedClass}
          onChange={e => setSelectedClass(e.target.value)}
        >
          <option value="">-- Chọn lớp --</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {selectedClass && (
          <div className="tab-group" style={{ margin: 0 }}>
            <button
              className={`tab ${tab === 'attendance' ? 'active' : ''}`}
              onClick={() => setTab('attendance')}
            >
              Chuyên cần
            </button>
            <button
              className={`tab ${tab === 'students' ? 'active' : ''}`}
              onClick={() => setTab('students')}
            >
              Học sinh & Ngày nghỉ ({studentStats.length})
            </button>
            <button
              className={`tab ${tab === 'assignments' ? 'active' : ''}`}
              onClick={() => setTab('assignments')}
            >
              Bài tập
            </button>
          </div>
        )}
      </div>

      {selectedClass && (
        <>
          {/* FILTER TOOLBAR (Theo Tuần, Tháng, Số buổi, Khoảng ngày) */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            marginBottom: '20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            {/* Filter Mode Selector Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#475569', marginRight: '6px' }}>
                <Filter size={15} color="#6366f1" />
                <span>Xem theo:</span>
              </div>

              {/* All */}
              <button
                onClick={() => setFilterMode('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: filterMode === 'all' ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  background: filterMode === 'all' ? '#eef2ff' : '#f8fafc',
                  color: filterMode === 'all' ? '#4f46e5' : '#64748b',
                  fontSize: '13px',
                  fontWeight: filterMode === 'all' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Tất cả các buổi
              </button>

              {/* By Week */}
              <button
                onClick={() => {
                  setFilterMode('week')
                  setWeekOffset(0)
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: filterMode === 'week' ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  background: filterMode === 'week' ? '#eef2ff' : '#f8fafc',
                  color: filterMode === 'week' ? '#4f46e5' : '#64748b',
                  fontSize: '13px',
                  fontWeight: filterMode === 'week' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Theo tuần
              </button>

              {/* By Month */}
              <button
                onClick={() => {
                  setFilterMode('month')
                  setMonthOffset(0)
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: filterMode === 'month' ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  background: filterMode === 'month' ? '#eef2ff' : '#f8fafc',
                  color: filterMode === 'month' ? '#4f46e5' : '#64748b',
                  fontSize: '13px',
                  fontWeight: filterMode === 'month' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Theo tháng
              </button>

              {/* By Recent Sessions */}
              <button
                onClick={() => setFilterMode('sessions')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: filterMode === 'sessions' ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  background: filterMode === 'sessions' ? '#eef2ff' : '#f8fafc',
                  color: filterMode === 'sessions' ? '#4f46e5' : '#64748b',
                  fontSize: '13px',
                  fontWeight: filterMode === 'sessions' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Theo số buổi gần nhất
              </button>

              {/* Custom Date Range */}
              <button
                onClick={() => setFilterMode('custom')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: filterMode === 'custom' ? '1px solid #6366f1' : '1px solid #e2e8f0',
                  background: filterMode === 'custom' ? '#eef2ff' : '#f8fafc',
                  color: filterMode === 'custom' ? '#4f46e5' : '#64748b',
                  fontSize: '13px',
                  fontWeight: filterMode === 'custom' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Khoảng ngày tùy chọn (Từ ngày... Đến ngày...)
              </button>
            </div>

            {/* Sub-controls based on active filterMode */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: '12px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '12px'
            }}>
              <div>
                {filterMode === 'week' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setWeekOffset(prev => prev - 1)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px'
                      }}
                    >
                      <ChevronLeft size={14} /> Tuần trước
                    </button>
                    <button
                      onClick={() => setWeekOffset(0)}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        background: weekOffset === 0 ? '#4f46e5' : 'white',
                        color: weekOffset === 0 ? 'white' : '#334155',
                        cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                      }}
                    >
                      Tuần này
                    </button>
                    <button
                      onClick={() => setWeekOffset(prev => prev + 1)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px'
                      }}
                    >
                      Tuần sau <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {filterMode === 'month' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setMonthOffset(prev => prev - 1)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px'
                      }}
                    >
                      <ChevronLeft size={14} /> Tháng trước
                    </button>
                    <button
                      onClick={() => setMonthOffset(0)}
                      style={{
                        padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        background: monthOffset === 0 ? '#4f46e5' : 'white',
                        color: monthOffset === 0 ? 'white' : '#334155',
                        cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                      }}
                    >
                      Tháng này
                    </button>
                    <button
                      onClick={() => setMonthOffset(prev => prev + 1)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px'
                      }}
                    >
                      Tháng sau <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {filterMode === 'sessions' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Số buổi:</span>
                    {[3, 5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        onClick={() => setSessionLimit(num)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: sessionLimit === num ? '1px solid #6366f1' : '1px solid #cbd5e1',
                          background: sessionLimit === num ? '#4f46e5' : 'white',
                          color: sessionLimit === num ? 'white' : '#334155',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {num} buổi
                      </button>
                    ))}
                  </div>
                )}

                {filterMode === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>Từ ngày:</span>
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={e => setCustomFromDate(e.target.value)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        fontSize: '13px', outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>Đến ngày:</span>
                    <input
                      type="date"
                      value={customToDate}
                      onChange={e => setCustomToDate(e.target.value)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        fontSize: '13px', outline: 'none'
                      }}
                    />
                  </div>
                )}

                {filterMode === 'all' && (
                  <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={15} color="#94a3b8" />
                    <span>Đang tổng hợp toàn bộ lịch sử điểm danh từ buổi đầu tiên đến nay.</span>
                  </div>
                )}
              </div>

              {/* Summary Indicator Chip */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '6px 12px', borderRadius: '8px', background: '#f1f5f9',
                fontSize: '13px', color: '#334155'
              }}>
                <Calendar size={14} color="#6366f1" />
                <span style={{ fontWeight: '600' }}>{filterSummaryLabel}</span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span style={{ color: '#059669', fontWeight: '700' }}>{totalSessionsInPeriod} buổi học</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content Area */}
      {!selectedClass ? (
        <div className="empty-state card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <BarChart3 size={48} color="#94a3b8" />
          <p style={{ marginTop: '12px', color: '#64748b', fontWeight: '500' }}>
            Vui lòng chọn lớp học phía trên để xem thống kê chi tiết
          </p>
        </div>
      ) : totalSessionsInPeriod === 0 && tab !== 'assignments' ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Clock size={40} color="#94a3b8" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
            Không có buổi học nào trong mốc thời gian này
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', margin: '0 auto 16px auto' }}>
            Lớp học chưa có buổi học nào được tạo trong khoảng thời gian ({filterSummaryLabel}). Bạn có thể chuyển sang chọn mốc thời gian khác hoặc xem &quot;Tất cả các buổi&quot;.
          </p>
          <button
            onClick={() => setFilterMode('all')}
            className="btn btn-secondary"
            style={{ fontSize: '13px' }}
          >
            Xem tất cả các buổi
          </button>
        </div>
      ) : (
        <div className="animate-fade-in">
          {/* TAB 1: ATTENDANCE CHART */}
          {tab === 'attendance' && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '2px' }}>
                    Biểu đồ chuyên cần
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>
                    {filterMode === 'sessions' || totalSessionsInPeriod <= 8
                      ? 'Thống kê chi tiết theo từng buổi học cụ thể'
                      : 'Thống kê tổng hợp số lượt có mặt, đi muộn, vắng theo tuần'}
                  </p>
                </div>
              </div>

              {chartData ? (
                <div style={{ maxHeight: '420px' }}>
                  <Bar
                    data={chartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      scales: {
                        x: { stacked: true },
                        y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
                      },
                      plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                          callbacks: {
                            footer: (tooltipItems) => {
                              let total = 0
                              tooltipItems.forEach((item) => {
                                total += (item.parsed?.y || 0)
                              })
                              return `Tổng học sinh: ${total}`
                            }
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Chưa có dữ liệu điểm danh trong giai đoạn này.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: STUDENTS ATTENDANCE BREAKDOWN & DETAILED ABSENCE DATES */}
          {tab === 'students' && (
            <div>
              {/* Warnings bar */}
              {studentStats.some(s => s.warning) && (
                <div style={{
                  background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '12px',
                  padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <AlertTriangle size={18} color="#92400e" />
                  <span style={{ fontSize: '13px', color: '#92400e', fontWeight: '600' }}>
                    Có {studentStats.filter(s => s.warning).length} học sinh vắng không phép ≥ {warningThreshold} buổi trong khoảng thời gian ({filterSummaryLabel}).
                  </span>
                </div>
              )}

              {/* Sub-toolbar: Search & Filter Pills & Bulk Actions */}
              <div style={{
                background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
                padding: '12px 16px', marginBottom: '16px', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
                  <div style={{ position: 'relative', width: '220px' }}>
                    <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                    <input
                      type="text"
                      placeholder="Tìm tên học sinh..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '6px 10px 6px 32px', borderRadius: '8px',
                        border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none'
                      }}
                    />
                  </div>

                  {/* Filter Pills */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setStudentStatusFilter('all')}
                      style={{
                        padding: '4px 10px', borderRadius: '14px', border: 'none',
                        background: studentStatusFilter === 'all' ? '#e0e7ff' : '#f1f5f9',
                        color: studentStatusFilter === 'all' ? '#4338ca' : '#64748b',
                        fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                      }}
                    >
                      Tất cả ({studentStats.length})
                    </button>
                    <button
                      onClick={() => setStudentStatusFilter('absent')}
                      style={{
                        padding: '4px 10px', borderRadius: '14px', border: 'none',
                        background: studentStatusFilter === 'absent' ? '#fee2e2' : '#f1f5f9',
                        color: studentStatusFilter === 'absent' ? '#b91c1c' : '#64748b',
                        fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                      }}
                    >
                      Có vắng ({studentStats.filter(s => s.absent_total > 0).length})
                    </button>
                    {studentStats.some(s => s.warning) && (
                      <button
                        onClick={() => setStudentStatusFilter('warning')}
                        style={{
                          padding: '4px 10px', borderRadius: '14px', border: 'none',
                          background: studentStatusFilter === 'warning' ? '#fef3c7' : '#f1f5f9',
                          color: studentStatusFilter === 'warning' ? '#b45309' : '#64748b',
                          fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                        }}
                      >
                        Cảnh báo ({studentStats.filter(s => s.warning).length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Bulk selection action bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedStudentIds.size > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#eff6ff', padding: '4px 12px', borderRadius: '8px', border: '1px solid #bfdbfe'
                    }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#1d4ed8' }}>
                        Đã chọn {selectedStudentIds.size} học sinh
                      </span>
                      <button
                        onClick={() => setSelectedStudentIds(new Set())}
                        style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
                      >
                        Bỏ chọn
                      </button>
                    </div>
                  )}

                  <button
                    onClick={toggleSelectAll}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                      background: 'white', fontSize: '12px', fontWeight: '600', color: '#475569',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    {selectedStudentIds.size === displayedStudents.length && displayedStudents.length > 0 ? (
                      <>
                        <CheckSquare size={14} color="#6366f1" /> Bỏ chọn tất cả
                      </>
                    ) : (
                      <>
                        <Square size={14} /> Chọn tất cả ({displayedStudents.length})
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Main Students Table */}
              <div className="table-container card">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.size === displayedStudents.length && displayedStudents.length > 0}
                          onChange={toggleSelectAll}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ width: '40px' }}>STT</th>
                      <th>Họ tên học sinh</th>
                      <th style={{ textAlign: 'center' }}>Có mặt</th>
                      <th style={{ textAlign: 'center' }}>Muộn</th>
                      <th style={{ textAlign: 'center' }}>Vắng CP</th>
                      <th style={{ textAlign: 'center' }}>Vắng KP</th>
                      <th style={{ textAlign: 'center' }}>Tổng buổi</th>
                      <th style={{ textAlign: 'center' }}>Tỉ lệ</th>
                      <th>Ngày nghỉ cụ thể</th>
                      <th style={{ textAlign: 'right', width: '120px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedStudents.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          Không tìm thấy học sinh nào phù hợp bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      displayedStudents.map((s, i) => {
                        const isSelected = selectedStudentIds.has(s.id)
                        return (
                          <tr
                            key={s.id}
                            style={{
                              background: isSelected ? '#f0fdf4' : s.warning ? '#fef2f2' : undefined,
                              transition: 'background 0.15s'
                            }}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectStudent(s.id)}
                                style={{ cursor: 'pointer' }}
                              />
                            </td>
                            <td>{i + 1}</td>
                            <td>
                              <div style={{ fontWeight: '600', color: '#0f172a' }}>{s.full_name}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>@{s.username}</div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-present">{s.present}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-late">{s.late}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-absent-excused">{s.excused}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className="badge badge-absent-unexcused">{s.unexcused}</span>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: '500' }}>
                              {s.total} buổi
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '42px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${s.rate}%`, height: '100%',
                                    background: s.rate >= 80 ? '#34d399' : s.rate >= 50 ? '#fbbf24' : '#f87171',
                                    borderRadius: '3px'
                                  }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: s.rate >= 80 ? '#059669' : s.rate >= 50 ? '#d97706' : '#dc2626' }}>
                                  {s.rate}%
                                </span>
                              </div>
                            </td>

                            {/* Specific Absent Dates Badges */}
                            <td>
                              {s.absentDates.length === 0 ? (
                                <span style={{
                                  fontSize: '12px', color: '#059669', background: '#ecfdf5',
                                  padding: '3px 8px', borderRadius: '6px', fontWeight: '600',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px'
                                }}>
                                  <CheckCircle2 size={12} /> Đủ 100%
                                </span>
                              ) : (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '280px' }}>
                                  {s.absentDates.map((ad, idx) => (
                                    <span
                                      key={idx}
                                      onClick={() => setViewingStudent(s)}
                                      title={`${ad.subject || 'Buổi học'} (${ad.status === 'absent_excused' ? 'Nghỉ có phép' : 'Nghỉ không phép'})${ad.notes ? ` - ${ad.notes}` : ''}`}
                                      style={{
                                        fontSize: '11px',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        background: ad.status === 'absent_excused' ? '#eff6ff' : '#fee2e2',
                                        color: ad.status === 'absent_excused' ? '#1d4ed8' : '#b91c1c',
                                        border: ad.status === 'absent_excused' ? '1px solid #bfdbfe' : '1px solid #fecaca',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {format(new Date(ad.date), 'dd/MM')} ({ad.status === 'absent_excused' ? 'CP' : 'KP'})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  onClick={() => setViewingStudent(s)}
                                  title="Xem chi tiết toàn bộ các ngày"
                                  style={{
                                    padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1',
                                    background: 'white', color: '#475569', fontSize: '12px', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <Eye size={13} /> Chi tiết
                                </button>

                                <button
                                  onClick={() => {
                                    const msg = generateStudentZaloReport(s)
                                    copyTextToClipboard(msg, `Đã copy báo cáo chuyên cần của ${s.full_name}`)
                                  }}
                                  title="Sao chép tin nhắn Zalo gửi Phụ huynh"
                                  style={{
                                    padding: '5px 8px', borderRadius: '6px', border: '1px solid #bfdbfe',
                                    background: '#eff6ff', color: '#1d4ed8', fontSize: '12px', cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <Copy size={13} /> Zalo
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ASSIGNMENTS BREAKDOWN */}
          {tab === 'assignments' && (
            <div className="table-container card">
              {assignmentStats.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Không có bài tập nào trong giai đoạn này.
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Bài tập</th>
                      <th>Hạn nộp</th>
                      <th>Nộp / Tổng HS</th>
                      <th>Tỉ lệ hoàn thành</th>
                      <th>TB Trắc nghiệm</th>
                      <th>TB Điểm tự luận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentStats.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: '600', color: '#0f172a' }}>{a.title}</td>
                        <td style={{ fontSize: '13px', color: '#64748b' }}>
                          {a.due_date ? format(new Date(a.due_date), 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                        <td>{a.submitted} / {a.total}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{
                                width: `${a.rate}%`, height: '100%',
                                background: Number(a.rate) >= 80 ? '#34d399' : Number(a.rate) >= 50 ? '#fbbf24' : '#f87171',
                                borderRadius: '3px'
                              }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: '600' }}>{a.rate}%</span>
                          </div>
                        </td>
                        <td style={{ fontWeight: '600', color: '#4f46e5' }}>{a.avgQuiz}</td>
                        <td style={{ fontWeight: '600', color: '#059669' }}>{a.avgManual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CHI TIẾT CHUYÊN CẦN CỦA 1 HỌC SINH */}
      {viewingStudent && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '16px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                    {viewingStudent.full_name}
                  </h3>
                  <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', color: '#475569' }}>
                    @{viewingStudent.username}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  Lớp: <strong style={{ color: '#334155' }}>{currentClassName}</strong> • Giai đoạn: <strong>{filterSummaryLabel}</strong>
                </div>
              </div>

              <button
                onClick={() => setViewingStudent(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px',
              marginBottom: '20px'
            }}>
              <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #d1fae5' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>{viewingStudent.present}</div>
                <div style={{ fontSize: '12px', color: '#047857', fontWeight: '600' }}>Có mặt</div>
              </div>
              <div style={{ background: '#fffbeb', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #fef3c7' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706' }}>{viewingStudent.late}</div>
                <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '600' }}>Đi muộn</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #dbeafe' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb' }}>{viewingStudent.excused}</div>
                <div style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: '600' }}>Vắng có phép</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '10px', textAlign: 'center', border: '1px solid #fee2e2' }}>
                <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>{viewingStudent.unexcused}</div>
                <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '600' }}>Vắng K.phép</div>
              </div>
            </div>

            {/* Absent Highlight Box if any */}
            {viewingStudent.absentDates.length > 0 ? (
              <div style={{
                background: '#fff1f2', border: '1px solid #fecaca', borderRadius: '10px',
                padding: '14px', marginBottom: '18px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#be123c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} /> Danh sách {viewingStudent.absentDates.length} buổi vắng mặt cụ thể:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {viewingStudent.absentDates.map((ad, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                        border: '1px solid #ffe4e6'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', color: '#1e293b' }}>
                          {format(new Date(ad.date), 'EEEE, dd/MM/yyyy', { locale: vi })}
                        </span>
                        <span style={{ color: '#64748b' }}>• {ad.subject}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px',
                          background: ad.status === 'absent_excused' ? '#dbeafe' : '#fee2e2',
                          color: ad.status === 'absent_excused' ? '#1d4ed8' : '#b91c1c',
                          fontWeight: '700', fontSize: '11px'
                        }}>
                          {ad.status === 'absent_excused' ? 'Có phép' : 'Không phép'}
                        </span>
                        {ad.notes && <span style={{ color: '#64748b', fontStyle: 'italic' }}>&quot;{ad.notes}&quot;</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px',
                padding: '12px', marginBottom: '18px', textAlign: 'center', color: '#047857', fontSize: '13px', fontWeight: '600'
              }}>
                🌟 Học sinh đi học chuyên cần đầy đủ tất cả {viewingStudent.total} buổi học trong giai đoạn này!
              </div>
            )}

            {/* Full Attendance Session Timeline */}
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
              Toàn bộ lịch sử {viewingStudent.sessionHistory.length} buổi học trong kỳ:
            </h4>
            <div style={{
              maxHeight: '220px', overflowY: 'auto', border: '1px solid #e2e8f0',
              borderRadius: '8px', marginBottom: '20px'
            }}>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Ngày học</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Môn học</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Phòng</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingStudent.sessionHistory.map((sh, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '600' }}>
                        {format(new Date(sh.date), 'dd/MM/yyyy')}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{sh.subject}</td>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{sh.room || '-'}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {sh.status === 'present' && <span className="badge badge-present">Có mặt</span>}
                        {sh.status === 'late' && <span className="badge badge-late">Đi muộn</span>}
                        {sh.status === 'absent_excused' && <span className="badge badge-absent-excused">Vắng CP</span>}
                        {sh.status === 'absent_unexcused' && <span className="badge badge-absent-unexcused">Vắng KP</span>}
                        {sh.status === 'unrecorded' && <span style={{ color: '#94a3b8' }}>Chưa điểm danh</span>}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#64748b', fontStyle: 'italic' }}>
                        {sh.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setViewingStudent(null)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: 'white', color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                }}
              >
                Đóng
              </button>

              <button
                onClick={() => {
                  const msg = generateStudentZaloReport(viewingStudent)
                  copyTextToClipboard(msg, `Đã sao chép tin nhắn Zalo gửi Phụ huynh em ${viewingStudent.full_name}`)
                }}
                style={{
                  padding: '8px 18px', borderRadius: '8px', border: 'none',
                  background: '#0068ff', color: 'white', fontWeight: '600', fontSize: '13px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  boxShadow: '0 2px 8px rgba(0, 104, 255, 0.3)'
                }}
              >
                <Copy size={15} /> Sao chép tin nhắn Zalo gửi Phụ huynh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BÁO CÁO ZALO NHÓM LỚP */}
      {showZaloReportModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '16px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#eff6ff', color: '#0068ff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                    Báo cáo Chuyên cần gửi Nhóm Zalo lớp
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {selectedStudentIds.size > 0
                      ? `Báo cáo cho ${selectedStudentIds.size} học sinh được chọn`
                      : `Báo cáo cho cả lớp ${currentClassName}`}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowZaloReportModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>
              Bạn có thể chỉnh sửa nội dung bên dưới trước khi bấm sao chép để dán vào nhóm Zalo của lớp:
            </p>

            <textarea
              value={zaloReportText}
              onChange={e => setZaloReportText(e.target.value)}
              rows={12}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                fontSize: '13px', lineHeight: '1.5', fontFamily: 'monospace', outline: 'none',
                background: '#f8fafc', marginBottom: '18px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={14} /> Định dạng sẵn icon, sẵn sàng dán vào Zalo
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowZaloReportModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    background: 'white', color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Đóng
                </button>

                <button
                  type="button"
                  onClick={() => {
                    copyTextToClipboard(zaloReportText, 'Đã sao chép tin nhắn Zalo thành công! Bạn chỉ cần vào nhóm Zalo ấn Ctrl + V để gửi.')
                    setShowZaloReportModal(false)
                  }}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: '#0068ff', color: 'white', fontWeight: '700', fontSize: '13px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 8px rgba(0, 104, 255, 0.3)'
                  }}
                >
                  <Copy size={15} /> Sao chép tin nhắn Zalo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
