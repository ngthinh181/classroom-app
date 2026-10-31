'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ClipboardCheck, Check, Save, ChevronLeft, Users } from 'lucide-react'
import type { Class, Session, Profile, Attendance, AttendanceStatus } from '@/lib/types'
import { ATTENDANCE_LABELS, ATTENDANCE_COLORS, isSessionCancelled, getSessionCancelReason, formatSessionNotes } from '@/lib/types'


export default function AttendancePage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [sessions, setSessions] = useState<(Session & { classes: { name: string } })[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [students, setStudents] = useState<Profile[]>([])
  const [attendanceData, setAttendanceData] = useState<Record<string, { status: AttendanceStatus; notes: string }>>({})
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'))
    loadClasses()
  }, [])
  useEffect(() => { if (selectedClass) loadSessions() }, [selectedClass, selectedDate])

  async function loadClasses() {
    const supabase = createClient()
    const { data } = await supabase.from('classes').select('*').order('name')
    setClasses(data || [])
    if (data && data.length > 0) {
      setSelectedClass(data[0].id)
    }
    setLoading(false)
  }

  async function loadSessions() {
    const supabase = createClient()
    const { data } = await supabase
      .from('sessions')
      .select('*, classes(name)')
      .eq('class_id', selectedClass)
      .eq('date', selectedDate)
      .order('start_time')
    setSessions((data as any) || [])
  }

  async function loadAttendance(session: Session) {
    setSelectedSession(session)
    const supabase = createClient()

    // Parallelize loading students and existing attendance
    const [scRes, attRes] = await Promise.all([
      supabase
        .from('students_classes')
        .select('profiles(*)')
        .eq('class_id', session.class_id),
      supabase
        .from('attendance')
        .select('*')
        .eq('session_id', session.id)
    ])

    const sc = scRes.data
    const att = attRes.data

    const studentList = (sc || [])
      .map((s: any) => s.profiles)
      .filter(Boolean)
      .sort((a: Profile, b: Profile) => a.full_name.localeCompare(b.full_name))
    setStudents(studentList)

    const attMap: Record<string, { status: AttendanceStatus; notes: string }> = {}
    studentList.forEach((s: Profile) => {
      const existing = (att as any[])?.find((a: any) => a.student_id === s.id)
      attMap[s.id] = {
        status: existing?.status || 'present',
        notes: existing?.notes || '',
      }
    })
    setAttendanceData(attMap)
  }

  function markAllPresent() {
    const updated = { ...attendanceData }
    Object.keys(updated).forEach(id => { updated[id].status = 'present' })
    setAttendanceData(updated)
    toast.success('Đã đánh dấu tất cả có mặt')
  }

  function updateStatus(studentId: string, status: AttendanceStatus) {
    setAttendanceData(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  function updateNotes(studentId: string, notes: string) {
    setAttendanceData(prev => ({ ...prev, [studentId]: { ...prev[studentId], notes } }))
  }

  async function handleSave() {
    if (!selectedSession) return
    setSaving(true)
    const supabase = createClient()

    const records = Object.entries(attendanceData).map(([student_id, data]) => ({
      session_id: selectedSession.id,
      student_id,
      status: data.status,
      notes: data.notes || null,
    }))

    // Upsert attendance records
    const { error } = await supabase
      .from('attendance')
      .upsert(records, { onConflict: 'session_id,student_id' })

    if (error) {
      toast.error('Lỗi lưu điểm danh')
    } else {
      toast.success('Đã lưu điểm danh')
    }
    setSaving(false)
  }

  async function handleToggleClassOff() {
    if (!selectedSession) return
    const isCancelled = isSessionCancelled(selectedSession)

    if (isCancelled) {
      if (!confirm('Khôi phục buổi học này thành buổi học bình thường?')) return
      setSaving(true)
      const supabase = createClient()
      const cleanNotes = selectedSession.notes
        ?.replace(/^\[LỚP NGHỈ[^\]]*\]\s*(\|)?\s*/i, '')
        .trim() || null

      const { error } = await supabase
        .from('sessions')
        .update({ notes: cleanNotes })
        .eq('id', selectedSession.id)

      if (error) {
        toast.error('Lỗi cập nhật buổi học')
      } else {
        toast.success('Đã mở lại buổi học bình thường')
        const updated = { ...selectedSession, notes: cleanNotes }
        setSelectedSession(updated)
        setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, notes: cleanNotes } : s))
      }
      setSaving(false)
    } else {
      const reason = prompt('Nhập lý do cho cả lớp nghỉ (ví dụ: Nghỉ lễ, Giáo viên bận, Thời tiết xấu...):', 'Giáo viên có việc bận')
      if (reason === null) return // User cancelled prompt

      setSaving(true)
      const supabase = createClient()
      const newNotes = formatSessionNotes(true, reason, selectedSession.notes || '')

      const { error } = await supabase
        .from('sessions')
        .update({ notes: newNotes })
        .eq('id', selectedSession.id)

      if (error) {
        toast.error('Lỗi đánh dấu lớp nghỉ')
      } else {
        toast.success('Đã đánh dấu cả lớp nghỉ (Không tính vào buổi học)')
        const updated = { ...selectedSession, notes: newNotes }
        setSelectedSession(updated)
        setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, notes: newNotes } : s))
      }
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="spinner" style={{ width: '32px', height: '32px' }} /></div>
  }

  const isCurrentSessionCancelled = selectedSession ? isSessionCancelled(selectedSession) : false
  const currentSessionCancelReason = selectedSession ? getSessionCancelReason(selectedSession.notes) : ''

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
          {selectedSession ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setSelectedSession(null)} className="btn btn-ghost" style={{ padding: '6px' }}>
                <ChevronLeft size={20} />
              </button>
              Điểm danh
            </span>
          ) : 'Điểm danh'}
        </h1>
      </div>

      {!selectedSession ? (
        <>
          {/* Filter */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '200px', flex: 1 }}>
              <label className="label">Lớp</label>
              <select className="input" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                <option value="">-- Chọn lớp --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ minWidth: '180px' }}>
              <label className="label">Ngày</label>
              <input className="input" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
          </div>

          {/* Sessions list */}
          {selectedClass && sessions.length === 0 && (
            <div className="empty-state card">
              <ClipboardCheck size={48} />
              <p>Không có buổi học nào trong ngày này</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessions.map(s => {
              const cancelled = isSessionCancelled(s)
              const cancelReason = getSessionCancelReason(s.notes)
              return (
                <div key={s.id} className="card" style={{
                  padding: '16px',
                  cursor: 'pointer',
                  border: cancelled ? '1.5px dashed #f59e0b' : undefined,
                  background: cancelled ? '#fffbeb' : undefined
                }}
                  onClick={() => loadAttendance(s)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600', fontSize: '16px', textDecoration: cancelled ? 'line-through' : 'none', color: cancelled ? '#78350f' : undefined }}>
                          {s.subject}
                        </span>
                        {cancelled && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: '#fef3c7',
                            color: '#b45309',
                            border: '1px solid #fde68a'
                          }}>
                            🚫 LỚP NGHỈ {cancelReason ? `(${cancelReason})` : ''}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {(s as any).classes?.name} • {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                        {s.room && ` • ${s.room}`}
                        {cancelled && <span style={{ color: '#b45309', marginLeft: '6px' }}>• Không tính vào tổng số buổi học</span>}
                      </div>
                    </div>
                    <ClipboardCheck size={20} color={cancelled ? '#b45309' : 'var(--primary)'} />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        /* Attendance form */
        <div>
          <div className="card" style={{
            padding: '16px',
            marginBottom: '16px',
            background: isCurrentSessionCancelled ? 'linear-gradient(135deg, #fef3c7, #fee2e2)' : 'linear-gradient(135deg, #e0e7ff, #ede9fe)',
            border: isCurrentSessionCancelled ? '1.5px solid #f59e0b' : undefined
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '700', fontSize: '17px', color: isCurrentSessionCancelled ? '#991b1b' : '#1e1b4b' }}>
                    {selectedSession.subject}
                  </span>
                  {isCurrentSessionCancelled && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: '#ef4444',
                      color: 'white'
                    }}>
                      🚫 HÔM NAY CHO CẢ LỚP NGHỈ
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: isCurrentSessionCancelled ? '#78350f' : 'var(--text-secondary)', marginTop: '4px' }}>
                  {format(new Date(selectedSession.date), "EEEE, dd/MM/yyyy", { locale: vi })} • {selectedSession.start_time?.slice(0, 5)} - {selectedSession.end_time?.slice(0, 5)}
                </div>
                {isCurrentSessionCancelled && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: '#b45309', fontWeight: '500' }}>
                    📝 Lý do nghỉ: <strong>{currentSessionCancelReason || 'Giáo viên cho lớp nghỉ'}</strong>
                    <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px' }}>
                      (Buổi này được loại trừ khỏi thống kê số buổi học của học sinh, nhưng sẽ được ghi chú rõ ràng trong bảng thống kê là "Lớp nghỉ").
                    </div>
                  </div>
                )}
              </div>

              {/* Toggle Class Off button */}
              <button
                className={`btn ${isCurrentSessionCancelled ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={handleToggleClassOff}
                disabled={saving}
                style={{
                  border: isCurrentSessionCancelled ? '1px solid #d97706' : '1px solid #f59e0b',
                  color: isCurrentSessionCancelled ? '#92400e' : '#b45309',
                  background: isCurrentSessionCancelled ? '#fff' : '#fef3c7',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                {isCurrentSessionCancelled ? '↩️ Hủy trạng thái nghỉ (Mở lại lớp)' : '🏖️ Đánh dấu cả lớp nghỉ hôm nay'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button className="btn btn-success" onClick={markAllPresent} disabled={isCurrentSessionCancelled}>
              <Check size={16} /> Tất cả có mặt
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || isCurrentSessionCancelled}>
              {saving ? <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> : <Save size={16} />}
              Lưu điểm danh
            </button>
            {isCurrentSessionCancelled && (
              <span style={{ fontSize: '13px', color: '#b45309', display: 'flex', alignItems: 'center', fontWeight: '500' }}>
                ⚠️ Lớp nghỉ: Không cần điểm danh, hệ thống tự động lưu trạng thái Lớp nghỉ.
              </span>
            )}
          </div>


          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {students.map((student, i) => (
              <div key={student.id} className="card" style={{ padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '700'
                    }}>
                      {i + 1}
                    </div>
                    <span style={{ fontWeight: '500', fontSize: '15px' }}>{student.full_name}</span>
                  </div>
                  <span className={`badge ${ATTENDANCE_COLORS[attendanceData[student.id]?.status || 'present']}`}>
                    {ATTENDANCE_LABELS[attendanceData[student.id]?.status || 'present']}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {(Object.entries(ATTENDANCE_LABELS) as [AttendanceStatus, string][]).map(([status, label]) => (
                    <button
                      key={status}
                      className={`btn ${attendanceData[student.id]?.status === status ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '6px 12px', fontSize: '12px', minHeight: '34px' }}
                      onClick={() => updateStatus(student.id, status)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <input
                  className="input"
                  placeholder="Ghi chú..."
                  value={attendanceData[student.id]?.notes || ''}
                  onChange={(e) => updateNotes(student.id, e.target.value)}
                  style={{ fontSize: '13px', minHeight: '36px' }}
                />
              </div>
            ))}
          </div>

          {students.length > 0 && (
            <div style={{ position: 'sticky', bottom: '16px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}
                style={{ width: '100%', fontSize: '16px', minHeight: '50px', boxShadow: '0 4px 20px rgba(99,102,241,0.4)' }}
              >
                {saving ? <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} /> : <Save size={18} />}
                Lưu điểm danh ({students.length} học sinh)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
