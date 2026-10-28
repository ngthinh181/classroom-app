'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import {
  format, startOfWeek, endOfWeek, addWeeks, subWeeks,
  eachDayOfInterval, isSameDay, isToday, parseISO
} from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Calendar, ChevronLeft, ChevronRight, Clock,
  MapPin, BookOpen, AlertCircle
} from 'lucide-react'
import { Session } from '@/lib/types'

export default function StudentSchedulePage() {
  const { user } = useAuth()
  const [currentWeek, setCurrentWeek] = useState<Date>(() => new Date('2026-01-01'))
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week')

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  useEffect(() => {
    setCurrentWeek(new Date())
  }, [])

  useEffect(() => {
    if (user) loadSessions()
  }, [currentWeek, user])

  async function loadSessions() {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    // Get student's enrolled classes
    const { data: enrollments } = await supabase
      .from('students_classes')
      .select('class_id, classes(id, name)')
      .eq('student_id', user.id)

    const classList = enrollments?.map((e: any) => e.classes).filter(Boolean) || []
    setClasses(classList)
    const classIds = classList.map((c: any) => c.id)

    if (classIds.length > 0) {
      const fromStr = format(weekStart, 'yyyy-MM-dd')
      const toStr = format(weekEnd, 'yyyy-MM-dd')

      const { data } = await supabase
        .from('sessions')
        .select('*, classes(name)')
        .in('class_id', classIds)
        .gte('date', fromStr)
        .lte('date', toStr)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      setSessions(data || [])
    } else {
      setSessions([])
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>Lịch học của em</h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            {classes.length > 0
              ? `Lớp: ${classes.map(c => c.name).join(', ')}`
              : 'Theo dõi thời khóa biểu và phòng học'}
          </p>
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '10px', padding: '3px' }}>
          <button
            onClick={() => setViewMode('week')}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              border: 'none', cursor: 'pointer',
              background: viewMode === 'week' ? '#fff' : 'transparent',
              color: viewMode === 'week' ? '#1e293b' : '#64748b',
              boxShadow: viewMode === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Theo tuần
          </button>
          <button
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              border: 'none', cursor: 'pointer',
              background: viewMode === 'list' ? '#fff' : 'transparent',
              color: viewMode === 'list' ? '#1e293b' : '#64748b',
              boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Danh sách
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <button
          onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ChevronLeft size={16} /> Tuần trước
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: '700', fontSize: '16px', color: '#1e293b' }}>
            {format(weekStart, 'dd/MM/yyyy')} – {format(weekEnd, 'dd/MM/yyyy')}
          </div>
          <button
            onClick={() => setCurrentWeek(new Date())}
            style={{
              background: 'none', border: 'none', color: '#4f46e5',
              fontSize: '12px', fontWeight: '600', cursor: 'pointer', marginTop: '2px'
            }}
          >
            Quay lại tuần này
          </button>
        </div>

        <button
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Tuần sau <ChevronRight size={16} />
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Đang tải lịch học...
        </div>
      ) : sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
          <Calendar size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
            Không có buổi học nào trong tuần này
          </h3>
          <p style={{ fontSize: '13px', maxWidth: '400px', margin: '0 auto' }}>
            Em có thể chuyển sang tuần khác bằng nút "Tuần trước" hoặc "Tuần sau" ở trên để xem lịch học các tuần khác.
          </p>
        </div>
      ) : viewMode === 'week' ? (
        /* Week Grid View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {weekDays.map((day) => {
            const daySessions = sessions.filter((s) => isSameDay(parseISO(s.date), day))
            const dayIsToday = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className="card"
                style={{
                  padding: '16px',
                  border: dayIsToday ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  background: dayIsToday ? '#fafafa' : '#fff'
                }}
              >
                {/* Day Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9'
                }}>
                  <div>
                    <div style={{
                      fontWeight: '700', fontSize: '14px',
                      color: dayIsToday ? '#4f46e5' : '#1e293b'
                    }}>
                      {format(day, 'EEEE', { locale: vi })}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {format(day, 'dd/MM/yyyy')}
                    </div>
                  </div>

                  {dayIsToday && (
                    <span style={{
                      background: '#4f46e5', color: 'white', fontSize: '11px',
                      padding: '2px 8px', borderRadius: '12px', fontWeight: '600'
                    }}>
                      Hôm nay
                    </span>
                  )}
                </div>

                {/* Day Sessions */}
                {daySessions.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '12px 0', textAlign: 'center' }}>
                    Không có tiết học
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {daySessions.map((session) => (
                      <div
                        key={session.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>
                          {session.subject}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4f46e5', fontWeight: '600' }}>
                          <Clock size={13} />
                          {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                        </div>

                        {session.room && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b' }}>
                            <MapPin size={13} /> {session.room}
                          </div>
                        )}

                        {session.notes && (
                          <div style={{ fontSize: '11px', color: '#475569', background: '#f1f5f9', padding: '6px 8px', borderRadius: '6px', marginTop: '2px' }}>
                            💡 {session.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ngày & Thứ</th>
                  <th>Môn học</th>
                  <th>Thời gian</th>
                  <th>Phòng học</th>
                  <th>Ghi chú giáo viên</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const sDate = parseISO(session.date)
                  const sIsToday = isToday(sDate)
                  return (
                    <tr key={session.id} style={{ background: sIsToday ? '#eff6ff' : 'transparent' }}>
                      <td style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>
                        <div>{format(sDate, 'EEEE', { locale: vi })}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{format(sDate, 'dd/MM/yyyy')}</div>
                        {sIsToday && (
                          <span style={{ background: '#2563eb', color: 'white', fontSize: '10px', padding: '1px 6px', borderRadius: '4px' }}>
                            Hôm nay
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: '700', color: '#1e293b' }}>{session.subject}</td>
                      <td style={{ whiteSpace: 'nowrap', color: '#4f46e5', fontWeight: '600' }}>
                        {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                      </td>
                      <td>{session.room || '—'}</td>
                      <td style={{ color: '#475569', fontSize: '13px' }}>{session.notes || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
