'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  ClipboardCheck, CheckCircle2, Clock,
  AlertCircle, XCircle, Filter, Calendar
} from 'lucide-react'
import { ATTENDANCE_LABELS, ATTENDANCE_COLORS, AttendanceStatus, isSessionCancelled, getSessionCancelReason } from '@/lib/types'

interface AttendanceRecord {
  id: string
  session_id: string
  status: AttendanceStatus | 'cancelled'
  notes: string | null
  created_at: string
  is_cancelled?: boolean
  cancel_reason?: string
  sessions: {
    id: string
    date: string
    subject: string
    start_time: string
    end_time: string
    room: string | null
    notes: string | null
  }
}

export default function StudentAttendancePage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    if (user) loadAttendance()
  }, [user])

  async function loadAttendance() {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from('attendance')
      .select('*, sessions(id, date, subject, start_time, end_time, room, notes)')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      const parsed = (data as unknown as AttendanceRecord[]).map(r => {
        const cancelled = isSessionCancelled(r.sessions)
        const cancelReason = getSessionCancelReason(r.sessions?.notes)
        return {
          ...r,
          is_cancelled: cancelled,
          cancel_reason: cancelReason,
        }
      })

      const sorted = parsed.sort((a, b) => {
        if (!a.sessions?.date || !b.sessions?.date) return 0
        return new Date(b.sessions.date).getTime() - new Date(a.sessions.date).getTime()
      })
      setRecords(sorted)
    }

    setLoading(false)
  }

  // Calculate statistics (EXCLUDING cancelled/holiday sessions from total taught sessions)
  const activeRecords = records.filter(r => !r.is_cancelled)
  const cancelledRecords = records.filter(r => r.is_cancelled)

  const total = activeRecords.length
  const present = activeRecords.filter(r => r.status === 'present').length
  const excused = activeRecords.filter(r => r.status === 'absent_excused').length
  const unexcused = activeRecords.filter(r => r.status === 'absent_unexcused').length
  const late = activeRecords.filter(r => r.status === 'late').length
  const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100

  // Filter records
  const filteredRecords = records.filter(r => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'cancelled') return r.is_cancelled
    if (filterStatus === 'absent') return !r.is_cancelled && (r.status === 'absent_excused' || r.status === 'absent_unexcused')
    return !r.is_cancelled && r.status === filterStatus
  })


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>Lịch sử chuyên cần</h1>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Theo dõi mức độ tham gia các buổi học và ghi nhận điểm danh của cô giáo
        </p>
      </div>

      {/* Overview Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {/* Attendance Rate */}
        <div className="card" style={{ padding: '20px', gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Tỷ lệ tham gia học tập</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669' }}>
                {attendanceRate}%
              </div>
            </div>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ClipboardCheck size={26} color="#059669" />
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${attendanceRate}%`,
                height: '100%',
                background: attendanceRate >= 80 ? '#10b981' : attendanceRate >= 60 ? '#f59e0b' : '#ef4444',
                transition: 'width 0.5s ease'
              }}
            />
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>
            Tổng số buổi đã ghi nhận: <strong>{total}</strong> buổi
          </div>
        </div>

        {/* Present card */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CheckCircle2 size={24} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Có mặt</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>{present}</div>
          </div>
        </div>

        {/* Excused Absent */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <AlertCircle size={24} color="#d97706" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Vắng có phép</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706' }}>{excused}</div>
          </div>
        </div>

        {/* Unexcused Absent */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <XCircle size={24} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Vắng không phép</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>{unexcused}</div>
          </div>
        </div>

        {/* Late */}
        <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Clock size={24} color="#2563eb" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Đi muộn</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#2563eb' }}>{late}</div>
          </div>
        </div>
      </div>

      {/* Filter and Records Table */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '12px', marginBottom: '16px'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Chi tiết từng buổi học</h2>

          {/* Filter options */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Filter size={16} color="#64748b" />
            <span style={{ fontSize: '13px', color: '#64748b', marginRight: '4px' }}>Lọc:</span>
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'present', label: 'Có mặt' },
              { id: 'absent', label: 'Vắng mặt' },
              { id: 'late', label: 'Đi muộn' },
              ...(cancelledRecords.length > 0 ? [{ id: 'cancelled', label: `Lớp nghỉ (${cancelledRecords.length})` }] : []),
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                  border: 'none', cursor: 'pointer',
                  background: filterStatus === tab.id ? '#4f46e5' : '#f1f5f9',
                  color: filterStatus === tab.id ? '#fff' : '#475569'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Đang tải dữ liệu điểm danh...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
            <ClipboardCheck size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ fontSize: '14px', fontWeight: '500' }}>Không tìm thấy bản ghi điểm danh nào</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ngày học</th>
                  <th>Môn học</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú giáo viên</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const sDate = r.sessions?.date ? parseISO(r.sessions.date) : null
                  return (
                    <tr
                      key={r.id}
                      style={{
                        background: r.is_cancelled ? '#fffbeb' : undefined
                      }}
                    >
                      <td style={{ whiteSpace: 'nowrap', fontWeight: '600' }}>
                        {sDate ? (
                          <div>
                            <div>{format(sDate, 'EEEE', { locale: vi })}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{format(sDate, 'dd/MM/yyyy')}</div>
                          </div>
                        ) : '—'}
                      </td>
                      <td style={{ fontWeight: '700', color: r.is_cancelled ? '#78350f' : '#1e293b' }}>
                        <span style={{ textDecoration: r.is_cancelled ? 'line-through' : 'none' }}>
                          {r.sessions?.subject || 'Buổi học'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: '#475569', fontSize: '13px' }}>
                        {r.sessions?.start_time ? `${r.sessions.start_time.slice(0, 5)} - ${r.sessions.end_time?.slice(0, 5)}` : '—'}
                      </td>
                      <td>
                        {r.is_cancelled ? (
                          <span style={{
                            padding: '3px 10px', borderRadius: '4px',
                            background: '#fef3c7', color: '#b45309',
                            fontWeight: '700', fontSize: '11px', border: '1px solid #fde68a',
                            display: 'inline-block'
                          }}>
                            🚫 Lớp nghỉ (Không tính buổi học)
                          </span>
                        ) : (
                          <span className={`badge ${ATTENDANCE_COLORS[r.status as AttendanceStatus] || ''}`}>
                            {ATTENDANCE_LABELS[r.status as AttendanceStatus] || r.status}
                          </span>
                        )}
                      </td>
                      <td style={{ color: r.is_cancelled ? '#b45309' : '#475569', fontSize: '13px', fontWeight: r.is_cancelled ? '600' : 'normal' }}>
                        {r.is_cancelled
                          ? (r.cancel_reason ? `Lý do: ${r.cancel_reason}` : 'Giáo viên cho cả lớp nghỉ')
                          : (r.notes || '—')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        )}
      </div>
    </div>
  )
}
