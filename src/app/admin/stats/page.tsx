'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addWeeks, subWeeks, addMonths, subMonths, parseISO
} from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  BarChart3, Download, AlertTriangle, Users, TrendingUp,
  Calendar, Clock, Filter, Hash, ChevronLeft, ChevronRight,
  Layers, CheckCircle2, ArrowRight
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

export default function StatsPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [tab, setTab] = useState<'attendance' | 'students' | 'assignments'>('attendance')

  // Filter state
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [weekOffset, setWeekOffset] = useState<number>(0) // 0: current week, -1: last week, etc.
  const [monthOffset, setMonthOffset] = useState<number>(0) // 0: current month, -1: last month, etc.
  const [sessionLimit, setSessionLimit] = useState<number>(5)
  const [customFromDate, setCustomFromDate] = useState<string>(() => format(subWeeks(new Date(), 2), 'yyyy-MM-dd'))
  const [customToDate, setCustomToDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'))

  // Filter summary
  const [filterSummaryLabel, setFilterSummaryLabel] = useState<string>('Toàn bộ thời gian')
  const [totalSessionsInPeriod, setTotalSessionsInPeriod] = useState<number>(0)

  // Data states
  const [attendanceStats, setAttendanceStats] = useState<any>(null)
  const [studentStats, setStudentStats] = useState<any[]>([])
  const [assignmentStats, setAssignmentStats] = useState<any[]>([])
  const [warningThreshold, setWarningThreshold] = useState(3)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClasses()
  }, [])

  useEffect(() => {
    if (selectedClass) {
      loadStats()
    }
  }, [selectedClass, tab, filterMode, weekOffset, monthOffset, sessionLimit, customFromDate, customToDate])

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
        .select('id, date, subject, start_time')
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
        .select('id, date, subject, start_time')
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
        .select('id, date, subject, start_time')
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
        .select('id, date, subject, start_time')
        .eq('class_id', selectedClass)
        .order('date', { ascending: false })
        .limit(sessionLimit)
      // Reverse to chronological order
      sessions = (data || []).reverse()
      label = `${sessionLimit} buổi học gần nhất`
    } else if (filterMode === 'custom') {
      const fromStr = customFromDate || '1970-01-01'
      const toStr = customToDate || '2099-12-31'

      const { data } = await supabase
        .from('sessions')
        .select('id, date, subject, start_time')
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

    // 2. Load tab specific statistics based on the filtered sessions
    if (tab === 'attendance') {
      if (sessionIds.length === 0) {
        setAttendanceStats({})
        return
      }

      const { data: attendance } = await supabase
        .from('attendance')
        .select('session_id, status, sessions!inner(class_id, date, subject)')
        .in('session_id', sessionIds)

      // If viewing by sessions or <= 8 sessions, group by each session date
      // Otherwise group by week
      const useDailyGrouping = filterMode === 'sessions' || sessions.length <= 8
      const groupedData: Record<string, { present: number; absent: number; late: number; total: number; title?: string }> = {}

      if (useDailyGrouping) {
        // Initialize all sessions in order so empty ones still appear
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
              .select('student_id, status, session_id')
              .in('session_id', sessionIds)
          : Promise.resolve({ data: [] })
      ])

      const sc = scRes.data || []
      const attendance = (attRes.data as any[]) || []
      const totalSessions = sessions.length

      const stats = sc.map((s: any) => {
        const studentAtt = attendance.filter((a: any) => a.student_id === s.student_id)
        const present = studentAtt.filter((a: any) => a.status === 'present').length
        const late = studentAtt.filter((a: any) => a.status === 'late').length
        const excused = studentAtt.filter((a: any) => a.status === 'absent_excused').length
        const unexcused = studentAtt.filter((a: any) => a.status === 'absent_unexcused').length
        const absentTotal = excused + unexcused

        // Attendance rate (%) out of total sessions in this period
        const rate = totalSessions > 0
          ? Math.round(((present + late * 0.5) / totalSessions) * 100)
          : 100

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

      // If custom date range or month, filter assignments due in that range
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

      // Group in memory
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

  async function exportToExcel() {
    const XLSX = await import('xlsx')
    let data: any[] = []
    let filename = `thong_ke_${filterMode}`

    if (tab === 'students') {
      data = studentStats.map((s, i) => ({
        'STT': i + 1,
        'Họ tên': s.full_name,
        'Có mặt': s.present,
        'Đi muộn': s.late,
        'Vắng có phép': s.excused,
        'Vắng không phép': s.unexcused,
        'Tổng buổi trong kỳ': s.total,
        'Tỉ lệ (%)': `${s.rate}%`,
        'Cảnh báo': s.warning ? 'CÓ' : '',
      }))
      filename = `thong_ke_chuyen_can_${filterMode}`
    } else if (tab === 'assignments') {
      data = assignmentStats.map((a, i) => ({
        'STT': i + 1,
        'Bài tập': a.title,
        'Đã nộp': a.submitted,
        'Tổng HS': a.total,
        'Tỉ lệ nộp (%)': a.rate,
        'TB trắc nghiệm': a.avgQuiz,
        'TB điểm tay': a.avgManual,
      }))
      filename = `thong_ke_bai_tap_${filterMode}`
    }

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Thống kê')
    XLSX.writeFile(wb, `${filename}.xlsx`)
    toast.success('Đã xuất file Excel thành công')
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
            Phân tích dữ liệu chuyên cần, tỉ lệ đi học và kết quả bài tập theo nhiều mốc thời gian.
          </p>
        </div>

        {selectedClass && (
          <button
            className="btn btn-secondary"
            onClick={exportToExcel}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
          >
            <Download size={15} /> Xuất Excel
          </button>
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
              Học sinh
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
                Khoảng ngày tùy chọn
              </button>
            </div>

            {/* Sub-controls based on active filterMode */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              paddingTop: '12px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '12px'
            }}>
              {/* Controls */}
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
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Từ ngày:</span>
                    <input
                      type="date"
                      value={customFromDate}
                      onChange={e => setCustomFromDate(e.target.value)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                        fontSize: '13px', outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Đến ngày:</span>
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
                    <span>Đang tổng hợp toàn bộ lịch sử điểm danh và bài tập từ trước đến nay.</span>
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
            Lớp học chưa có lịch học nào được lên trong khoảng thời gian ({filterSummaryLabel}). Bạn có thể chuyển sang chọn mốc thời gian khác hoặc xem &quot;Tất cả các buổi&quot;.
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
                      ? 'Thống kê chi tiết theo từng buổi học'
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

          {/* TAB 2: STUDENTS ATTENDANCE BREAKDOWN */}
          {tab === 'students' && (
            <div>
              {studentStats.some(s => s.warning) && (
                <div style={{
                  background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '12px',
                  padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                  <AlertTriangle size={20} color="#92400e" />
                  <span style={{ fontSize: '14px', color: '#92400e', fontWeight: '600' }}>
                    Có {studentStats.filter(s => s.warning).length} học sinh vắng không phép ≥ {warningThreshold} buổi trong khoảng thời gian này
                  </span>
                </div>
              )}

              <div className="table-container card">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>STT</th>
                      <th>Họ tên</th>
                      <th>Có mặt</th>
                      <th>Đi muộn</th>
                      <th>VP có phép</th>
                      <th>VP không phép</th>
                      <th>Tổng số buổi</th>
                      <th>Tỉ lệ đi học</th>
                      <th style={{ width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentStats.map((s, i) => (
                      <tr key={s.id} style={{ background: s.warning ? '#fef2f2' : undefined }}>
                        <td>{i + 1}</td>
                        <td style={{ fontWeight: '600', color: '#0f172a' }}>{s.full_name}</td>
                        <td><span className="badge badge-present">{s.present}</span></td>
                        <td><span className="badge badge-late">{s.late}</span></td>
                        <td><span className="badge badge-absent-excused">{s.excused}</span></td>
                        <td><span className="badge badge-absent-unexcused">{s.unexcused}</span></td>
                        <td style={{ fontWeight: '500' }}>{s.total} buổi</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '54px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
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
                        <td>
                          {s.warning && (
                            <span title="Cảnh báo nghỉ nhiều">
                              <AlertTriangle size={17} color="#ef4444" />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
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
    </div>
  )
}
