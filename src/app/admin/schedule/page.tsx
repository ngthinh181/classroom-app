'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval,
  addDays, parseISO
} from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Plus, ChevronLeft, ChevronRight, X, Calendar, Repeat,
  Edit, Trash2, CalendarClock, Clock, Sparkles, AlertCircle,
  CheckCircle2, Ban, MapPin, BookOpen
} from 'lucide-react'
import type { Class, Session } from '@/lib/types'
import { DAYS_OF_WEEK, isSessionCancelled, getSessionCancelReason, SESSION_CANCELLED_PREFIX } from '@/lib/types'
import {
  FixedScheduleSlot, getFixedSchedule, encodeFixedSchedule,
  generateSessionsFromSchedule, getCleanDescription
} from '@/lib/schedule-utils'

export default function SchedulePage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [loading, setLoading] = useState(true)

  // Single Session Modal
  const [showModal, setShowModal] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [form, setForm] = useState(() => ({
    class_id: '', subject: '', date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '08:00', end_time: '09:30', room: '', notes: ''
  }))
  const [isCancelledSession, setIsCancelledSession] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  // Fixed Weekly Schedule Modal
  const [showFixedModal, setShowFixedModal] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [fixedSlots, setFixedSlots] = useState<FixedScheduleSlot[]>([])
  const [slotForm, setSlotForm] = useState<Omit<FixedScheduleSlot, 'id'>>({
    day_of_week: 1,
    start_time: '19:00',
    end_time: '20:30',
    subject: 'Toán',
    room: '',
    notes: ''
  })
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null)
  const [syncWeeks, setSyncWeeks] = useState<number>(16)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  // Repeat modal (legacy / custom date range)
  const [showRepeatModal, setShowRepeatModal] = useState(false)
  const [repeatForm, setRepeatForm] = useState(() => ({
    class_id: '', subject: '', start_time: '08:00', end_time: '09:30',
    room: '', notes: '', days: [] as number[],
    from_date: format(new Date(), 'yyyy-MM-dd'),
    to_date: format(addWeeks(new Date(), 4), 'yyyy-MM-dd')
  }))

  useEffect(() => {
    loadClasses()
  }, [])

  useEffect(() => {
    loadSessions()
  }, [currentWeekStart])

  async function loadClasses() {
    const supabase = createClient()
    const { data } = await supabase.from('classes').select('*').order('name')
    const classList = data || []
    setClasses(classList)
    if (classList.length > 0 && !selectedClassId) {
      setSelectedClassId(classList[0].id)
      setFixedSlots(getFixedSchedule(classList[0].description))
    }
  }

  async function loadSessions() {
    const supabase = createClient()
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })
    const { data } = await supabase
      .from('sessions')
      .select('*, classes(name)')
      .gte('date', format(currentWeekStart, 'yyyy-MM-dd'))
      .lte('date', format(weekEnd, 'yyyy-MM-dd'))
      .order('date')
      .order('start_time')
    setSessions((data as any) || [])
    setLoading(false)
  }

  // --- Single Session Management ---
  function openAddSessionModal(dateStr?: string) {
    setEditingSession(null)
    setIsCancelledSession(false)
    setCancelReason('')
    setForm({
      class_id: classes[0]?.id || '',
      subject: '',
      date: dateStr || format(new Date(), 'yyyy-MM-dd'),
      start_time: '19:00',
      end_time: '20:30',
      room: '',
      notes: ''
    })
    setShowModal(true)
  }

  function openEditSessionModal(s: Session) {
    setEditingSession(s)
    const cancelled = isSessionCancelled(s)
    setIsCancelledSession(cancelled)
    setCancelReason(cancelled ? getSessionCancelReason(s.notes) : '')
    
    // Clean notes from [LỚP NGHỈ] prefix
    let cleanNotes = s.notes || ''
    if (cancelled && s.notes) {
      const idx = s.notes.indexOf(']')
      if (idx !== -1) {
        cleanNotes = s.notes.substring(idx + 1).replace(/^:\s*/, '').trim()
      }
    }

    setForm({
      class_id: s.class_id,
      subject: s.subject,
      date: s.date,
      start_time: s.start_time?.slice(0, 5) || '19:00',
      end_time: s.end_time?.slice(0, 5) || '20:30',
      room: s.room || '',
      notes: cleanNotes
    })
    setShowModal(true)
  }

  async function handleSaveSession(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()

    let finalNotes = form.notes.trim()
    if (isCancelledSession) {
      const reasonText = cancelReason.trim() ? `: ${cancelReason.trim()}` : ''
      finalNotes = `${SESSION_CANCELLED_PREFIX}${reasonText}${finalNotes ? ` (${finalNotes})` : ''}`
    }

    const payload = {
      ...form,
      notes: finalNotes
    }

    if (editingSession) {
      const { error } = await supabase.from('sessions').update(payload).eq('id', editingSession.id)
      if (error) { toast.error('Lỗi cập nhật: ' + error.message); return }
      toast.success(isCancelledSession ? 'Đã cập nhật buổi học (Đã đánh dấu lớp nghỉ)' : 'Đã cập nhật buổi học')
    } else {
      const { error } = await supabase.from('sessions').insert(payload)
      if (error) { toast.error('Lỗi tạo buổi học: ' + error.message); return }
      toast.success('Đã tạo buổi học mới')
    }
    setShowModal(false)
    setEditingSession(null)
    loadSessions()
  }

  async function handleDeleteSession(id: string) {
    if (!confirm('Xóa buổi học này?')) return
    const supabase = createClient()
    await supabase.from('sessions').delete().eq('id', id)
    toast.success('Đã xóa buổi học')
    loadSessions()
  }

  // --- Fixed Recurring Weekly Schedule Management ---
  function openFixedScheduleModal(classIdToOpen?: string) {
    const targetId = classIdToOpen || selectedClassId || classes[0]?.id || ''
    setSelectedClassId(targetId)
    const targetClass = classes.find(c => c.id === targetId)
    if (targetClass) {
      setFixedSlots(getFixedSchedule(targetClass.description))
    } else {
      setFixedSlots([])
    }
    setEditingSlotId(null)
    setShowFixedModal(true)
  }

  function handleSelectFixedClass(cid: string) {
    setSelectedClassId(cid)
    const targetClass = classes.find(c => c.id === cid)
    if (targetClass) {
      setFixedSlots(getFixedSchedule(targetClass.description))
    } else {
      setFixedSlots([])
    }
    setEditingSlotId(null)
  }

  function handleAddOrUpdateSlot(e: React.FormEvent) {
    e.preventDefault()
    if (!slotForm.subject.trim()) {
      toast.error('Vui lòng nhập môn học')
      return
    }

    if (editingSlotId) {
      // Update existing slot
      setFixedSlots(prev => prev.map(slot =>
        slot.id === editingSlotId ? { ...slotForm, id: editingSlotId } : slot
      ))
      setEditingSlotId(null)
      toast.success('Đã cập nhật ca học')
    } else {
      // Add new slot
      const newSlot: FixedScheduleSlot = {
        ...slotForm,
        id: 'slot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
      }
      setFixedSlots(prev => [...prev, newSlot])
      toast.success('Đã thêm ca học cố định')
    }

    // Reset slot form to default
    setSlotForm({
      day_of_week: 1,
      start_time: '19:00',
      end_time: '20:30',
      subject: slotForm.subject || 'Toán',
      room: slotForm.room || '',
      notes: ''
    })
  }

  function handleRemoveSlot(slotId: string) {
    setFixedSlots(prev => prev.filter(s => s.id !== slotId))
    if (editingSlotId === slotId) setEditingSlotId(null)
    toast.success('Đã xóa ca học khỏi lịch cố định')
  }

  function handleEditSlot(slot: FixedScheduleSlot) {
    setEditingSlotId(slot.id)
    setSlotForm({
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      subject: slot.subject,
      room: slot.room || '',
      notes: slot.notes || ''
    })
  }

  /**
   * Save fixed schedule template and automatically generate sessions for whole semester
   */
  async function handleApplyFixedSchedule() {
    if (!selectedClassId) {
      toast.error('Vui lòng chọn lớp học')
      return
    }

    const targetClass = classes.find(c => c.id === selectedClassId)
    if (!targetClass) return

    setIsSyncing(true)
    const supabase = createClient()

    try {
      // 1. Encode and save fixed slots into classes table
      const updatedDescription = encodeFixedSchedule(targetClass.description, fixedSlots)
      const { error: updateClassError } = await supabase
        .from('classes')
        .update({ description: updatedDescription })
        .eq('id', selectedClassId)

      if (updateClassError) {
        toast.error('Lỗi lưu lịch cố định: ' + updateClassError.message)
        setIsSyncing(false)
        return
      }

      // 2. If slots are empty, just update class
      if (fixedSlots.length === 0) {
        toast.success('Đã lưu cấu hình (chưa có ca học cố định)')
        setIsSyncing(false)
        loadClasses()
        return
      }

      // 3. Query existing sessions for this class to avoid duplicates
      const startDate = startOfWeek(new Date(), { weekStartsOn: 1 })
      const endDate = addWeeks(startDate, syncWeeks)

      const { data: existingData } = await supabase
        .from('sessions')
        .select('date, start_time, class_id')
        .eq('class_id', selectedClassId)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))

      const existingSessions = ((existingData as any[]) || []).map((s: any) => ({
        date: s.date,
        start_time: s.start_time,
        class_id: s.class_id
      }))

      // 4. Generate new session slots
      const newSessions = generateSessionsFromSchedule(
        selectedClassId,
        fixedSlots,
        startDate,
        syncWeeks,
        existingSessions
      )

      if (newSessions.length > 0) {
        // Insert in batches of 50
        const batchSize = 50
        for (let i = 0; i < newSessions.length; i += batchSize) {
          const batch = newSessions.slice(i, i + batchSize)
          const { error: insertError } = await supabase.from('sessions').insert(batch)
          if (insertError) {
            console.error('Batch insert error:', insertError)
          }
        }
        toast.success(`Đã lưu lịch cố định & tự động tạo ${newSessions.length} buổi học (${syncWeeks} tuần)!`)
      } else {
        toast.success(`Đã lưu lịch cố định! Tất cả các buổi học trong ${syncWeeks} tuần đã có sẵn.`)
      }

      setShowFixedModal(false)
      loadClasses()
      loadSessions()
    } catch (err: any) {
      toast.error('Lỗi: ' + (err.message || 'Không thể đồng bộ lịch'))
    } finally {
      setIsSyncing(false)
    }
  }

  /**
   * One-click sync fixed schedule for current viewed week
   */
  async function handleQuickSyncCurrentWeek() {
    if (classes.length === 0) return
    setIsSyncing(true)
    const supabase = createClient()
    let createdCount = 0

    try {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 })

      for (const cls of classes) {
        const slots = getFixedSchedule(cls.description)
        if (slots.length === 0) continue

        const { data: existingData } = await supabase
          .from('sessions')
          .select('date, start_time, class_id')
          .eq('class_id', cls.id)
          .gte('date', format(currentWeekStart, 'yyyy-MM-dd'))
          .lte('date', format(weekEnd, 'yyyy-MM-dd'))

        const existingSessions = ((existingData as any[]) || []).map((s: any) => ({
          date: s.date,
          start_time: s.start_time,
          class_id: s.class_id
        }))

        const newSessions = generateSessionsFromSchedule(
          cls.id,
          slots,
          currentWeekStart,
          1,
          existingSessions
        )

        if (newSessions.length > 0) {
          await supabase.from('sessions').insert(newSessions)
          createdCount += newSessions.length
        }
      }

      if (createdCount > 0) {
        toast.success(`Đã tạo nhanh ${createdCount} buổi học cố định cho tuần này!`)
        loadSessions()
      } else {
        toast.success('Tuần này đã có đầy đủ các buổi học theo lịch cố định!')
      }
    } catch (err: any) {
      toast.error('Lỗi đồng bộ: ' + err.message)
    } finally {
      setIsSyncing(false)
    }
  }

  // --- Legacy Repeat Modal ---
  async function handleCreateRepeat(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { days, from_date, to_date, ...sessionData } = repeatForm
    
    if (days.length === 0) { toast.error('Chọn ít nhất một ngày trong tuần'); return }
    
    const start = parseISO(from_date)
    const end = parseISO(to_date)
    const allDays = eachDayOfInterval({ start, end })
    const sessionsToCreate = allDays
      .filter(d => days.includes(d.getDay()))
      .map(d => ({ ...sessionData, date: format(d, 'yyyy-MM-dd') }))
    
    if (sessionsToCreate.length === 0) { toast.error('Không có buổi nào để tạo'); return }
    
    const { error } = await supabase.from('sessions').insert(sessionsToCreate)
    if (error) { toast.error('Lỗi tạo lịch'); return }
    toast.success(`Đã tạo ${sessionsToCreate.length} buổi học`)
    setShowRepeatModal(false)
    loadSessions()
  }

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  })

  const getSessionsForDay = (date: Date) =>
    sessions.filter(s => s.date === format(date, 'yyyy-MM-dd'))

  const currentClass = classes.find(c => c.id === selectedClassId)

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="spinner" style={{ width: '32px', height: '32px' }} /></div>
  }

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>Lịch học</h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Lịch học cố định tự động áp dụng qua các tuần, giáo viên chỉ cần sửa khi có thay đổi hoặc cho nghỉ
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
            onClick={() => openFixedScheduleModal()}
          >
            <CalendarClock size={16} /> Lịch học cố định theo tuần
          </button>

          <button className="btn btn-secondary" onClick={() => setShowRepeatModal(true)}>
            <Repeat size={16} /> Tạo tùy chọn
          </button>

          <button className="btn btn-secondary" onClick={() => openAddSessionModal()}>
            <Plus size={16} /> Thêm 1 buổi lẻ
          </button>
        </div>
      </div>

      {/* Week navigation & Quick actions */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#fff', padding: '12px 18px', borderRadius: '14px',
        border: '1px solid var(--border)', marginBottom: '20px', flexWrap: 'wrap', gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, -1))}>
            <ChevronLeft size={20} />
          </button>
          <h2 style={{ fontSize: '16px', fontWeight: '700', minWidth: '220px', textAlign: 'center', color: '#1e293b' }}>
            {format(currentWeekStart, "'Tuần' dd/MM", { locale: vi })} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'dd/MM/yyyy')}
          </h2>
          <button className="btn btn-ghost" style={{ padding: '8px' }} onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
            <ChevronRight size={20} />
          </button>
          <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }}
            onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hôm nay
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            disabled={isSyncing}
            onClick={handleQuickSyncCurrentWeek}
            style={{ fontSize: '13px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Tự động điền các ca học cố định còn thiếu vào tuần này"
          >
            <Sparkles size={14} color="#6366f1" />
            {isSyncing ? 'Đang đồng bộ...' : 'Điền lịch cố định cho tuần này'}
          </button>
        </div>
      </div>

      {/* Week Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        {weekDays.map((day) => {
          const daySessions = getSessionsForDay(day)
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
          const dateStr = format(day, 'yyyy-MM-dd')

          return (
            <div key={day.toISOString()} className="card" style={{
              padding: '14px', minHeight: '140px',
              borderTop: isToday ? '3px solid var(--primary)' : '1px solid var(--border)',
              background: isToday ? '#fcfcff' : '#fff'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9'
              }}>
                <div>
                  <div style={{
                    fontSize: '11px', fontWeight: '700',
                    color: isToday ? 'var(--primary)' : '#64748b',
                    textTransform: 'uppercase'
                  }}>
                    {format(day, 'EEEE', { locale: vi })}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: isToday ? 'var(--primary)' : '#1e293b' }}>
                    {format(day, 'dd/MM')}
                  </div>
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '4px', color: '#94a3b8' }}
                  title="Thêm buổi học ngày này"
                  onClick={() => openAddSessionModal(dateStr)}
                >
                  <Plus size={14} />
                </button>
              </div>

              {daySessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#cbd5e1', fontSize: '12px' }}>
                  Trống
                </div>
              ) : (
                daySessions.map((s) => {
                  const cancelled = isSessionCancelled(s)
                  const reason = cancelled ? getSessionCancelReason(s.notes) : ''

                  return (
                    <div
                      key={s.id}
                      onClick={() => openEditSessionModal(s)}
                      style={{
                        background: cancelled
                          ? '#fef2f2'
                          : 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
                        border: cancelled
                          ? '1px dashed #f87171'
                          : '1px solid #e0e7ff',
                        borderRadius: '10px',
                        padding: '10px',
                        marginBottom: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        position: 'relative',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'transform 0.1s'
                      }}
                    >
                      {cancelled && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          color: '#dc2626', fontWeight: '700', fontSize: '11px',
                          background: '#fee2e2', padding: '2px 6px', borderRadius: '4px',
                          marginBottom: '4px'
                        }}>
                          <Ban size={10} /> LỚP NGHỈ
                        </div>
                      )}

                      <div style={{
                        fontWeight: '700',
                        color: cancelled ? '#991b1b' : '#1e1b4b',
                        marginBottom: '2px',
                        textDecoration: cancelled ? 'line-through' : 'none'
                      }}>
                        {s.subject}
                      </div>

                      <div style={{ color: '#475569', fontSize: '11px', fontWeight: '500' }}>
                        {(s as any).classes?.name}
                      </div>

                      <div style={{
                        color: cancelled ? '#dc2626' : 'var(--primary)',
                        fontWeight: '600',
                        marginTop: '4px',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}>
                        <Clock size={11} />
                        {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                      </div>

                      {s.room && (
                        <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <MapPin size={10} /> {s.room}
                        </div>
                      )}

                      {cancelled && reason && (
                        <div style={{ color: '#dc2626', fontSize: '10px', marginTop: '4px', fontStyle: 'italic' }}>
                          Lý do: {reason}
                        </div>
                      )}

                      <button
                        className="btn btn-ghost"
                        style={{ position: 'absolute', top: '4px', right: '4px', padding: '3px' }}
                        onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                        title="Xóa buổi này"
                      >
                        <Trash2 size={12} color="#94a3b8" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )
        })}
      </div>

      {/* FIXED SCHEDULE (THỜI KHÓA BIỂU CỐ ĐỊNH THEO TUẦN) MODAL */}
      {showFixedModal && (
        <div className="modal-overlay" onClick={() => !isSyncing && setShowFixedModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '28px', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                  <CalendarClock size={22} />
                  <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                    Cài đặt Lịch học cố định theo tuần
                  </h2>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  Lịch học sẽ tự động lặp lại hàng tuần cho cả học kỳ, giáo viên không cần nhập lại mỗi tuần
                </p>
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px' }} disabled={isSyncing} onClick={() => setShowFixedModal(false)}><X size={20} /></button>
            </div>

            {/* Step 1: Select Class */}
            <div style={{ marginBottom: '20px' }}>
              <label className="label" style={{ fontWeight: '600' }}>Chọn lớp học cần cài đặt *</label>
              <select
                className="input"
                value={selectedClassId}
                onChange={(e) => handleSelectFixedClass(e.target.value)}
                style={{ fontWeight: '600', fontSize: '15px' }}
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.school_year}) - {getCleanDescription(c.description) || 'Lớp học'}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Current Fixed Weekly Slots */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label className="label" style={{ fontWeight: '600', margin: 0 }}>
                  Thời khóa biểu cố định trong tuần ({fixedSlots.length} ca học)
                </label>
                {fixedSlots.length > 0 && (
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>
                    ✓ Lịch định kỳ đã kích hoạt
                  </span>
                )}
              </div>

              {fixedSlots.length === 0 ? (
                <div style={{
                  background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px',
                  padding: '24px', textAlign: 'center', color: '#64748b'
                }}>
                  <CalendarClock size={32} style={{ margin: '0 auto 8px', color: '#94a3b8' }} />
                  <p style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>Chưa có ca học cố định nào cho lớp này</p>
                  <p style={{ fontSize: '12px' }}>Thêm các ca học cố định bên dưới (VD: Thứ 2 và Thứ 5 từ 19:30 - 21:00)</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {fixedSlots
                    .slice()
                    .sort((a, b) => {
                      const dayA = a.day_of_week === 0 ? 7 : a.day_of_week
                      const dayB = b.day_of_week === 0 ? 7 : b.day_of_week
                      if (dayA !== dayB) return dayA - dayB
                      return a.start_time.localeCompare(b.start_time)
                    })
                    .map((slot) => {
                      const dayObj = DAYS_OF_WEEK.find(d => d.value === slot.day_of_week) || { label: `Thứ ${slot.day_of_week + 1}` }
                      const isEditing = editingSlotId === slot.id

                      return (
                        <div
                          key={slot.id}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: isEditing ? '#eff6ff' : '#f8fafc',
                            border: `1px solid ${isEditing ? '#3b82f6' : '#e2e8f0'}`,
                            borderRadius: '10px', padding: '12px 16px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <span style={{
                              background: '#4f46e5', color: '#fff', padding: '4px 10px',
                              borderRadius: '6px', fontSize: '12px', fontWeight: '700'
                            }}>
                              {dayObj.label}
                            </span>
                            <span style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>
                              {slot.subject}
                            </span>
                            <span style={{ color: '#4f46e5', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={13} /> {slot.start_time} - {slot.end_time}
                            </span>
                            {slot.room && (
                              <span style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={13} /> {slot.room}
                              </span>
                            )}
                            {slot.notes && (
                              <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>
                                ({slot.notes})
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '6px' }}
                              title="Sửa ca học"
                              onClick={() => handleEditSlot(slot)}
                            >
                              <Edit size={14} color="#3b82f6" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '6px' }}
                              title="Xóa ca học"
                              onClick={() => handleRemoveSlot(slot.id)}
                            >
                              <Trash2 size={14} color="#ef4444" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Step 3: Add / Edit Fixed Slot Form */}
            <form onSubmit={handleAddOrUpdateSlot} style={{
              background: '#f1f5f9', borderRadius: '12px', padding: '16px', marginBottom: '24px'
            }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{editingSlotId ? '✏️ Cập nhật ca học cố định' : '➕ Thêm ca học cố định trong tuần'}</span>
                {editingSlotId && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: '12px', padding: '2px 8px' }}
                    onClick={() => {
                      setEditingSlotId(null)
                      setSlotForm({ day_of_week: 1, start_time: '19:00', end_time: '20:30', subject: 'Toán', room: '', notes: '' })
                    }}
                  >
                    Hủy sửa
                  </button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label className="label" style={{ fontSize: '12px' }}>Thứ trong tuần *</label>
                  <select
                    className="input"
                    value={slotForm.day_of_week}
                    onChange={(e) => setSlotForm({ ...slotForm, day_of_week: Number(e.target.value) })}
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" style={{ fontSize: '12px' }}>Giờ bắt đầu *</label>
                  <input
                    type="time"
                    className="input"
                    required
                    value={slotForm.start_time}
                    onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="label" style={{ fontSize: '12px' }}>Giờ kết thúc *</label>
                  <input
                    type="time"
                    className="input"
                    required
                    value={slotForm.end_time}
                    onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="label" style={{ fontSize: '12px' }}>Môn / Nội dung *</label>
                  <input
                    className="input"
                    required
                    placeholder="VD: Toán"
                    value={slotForm.subject}
                    onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="label" style={{ fontSize: '12px' }}>Phòng học</label>
                  <input
                    className="input"
                    placeholder="VD: 101"
                    value={slotForm.room}
                    onChange={(e) => setSlotForm({ ...slotForm, room: e.target.value })}
                    style={{ padding: '6px 10px', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '13px' }}>
                  {editingSlotId ? 'Cập nhật ca này' : '+ Thêm ca học này vào lịch cố định'}
                </button>
              </div>
            </form>

            {/* Step 4: Apply to Semester Generator */}
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px',
              padding: '18px', marginBottom: '20px'
            }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e3a8a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#2563eb" />
                Áp dụng lịch cố định cho cả học kỳ / năm học
              </div>
              <p style={{ fontSize: '13px', color: '#3b82f6', marginBottom: '14px' }}>
                Hệ thống sẽ tự động tạo sẵn toàn bộ các buổi học qua các tuần. Những buổi đã tồn tại hoặc đã sửa/cho nghỉ sẽ được bảo lưu nguyên vẹn, không bị ghi đè!
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                  Thời gian áp dụng:
                </label>
                {[
                  { weeks: 12, label: '12 tuần (3 tháng)' },
                  { weeks: 16, label: '16 tuần (Học kỳ 1)' },
                  { weeks: 24, label: '24 tuần (Nửa năm)' },
                  { weeks: 36, label: '36 tuần (Cả năm học)' },
                ].map(item => (
                  <label key={item.weeks} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                    background: syncWeeks === item.weeks ? '#2563eb' : '#fff',
                    color: syncWeeks === item.weeks ? '#fff' : '#1e293b',
                    border: '1px solid var(--border)', fontSize: '13px', fontWeight: '500'
                  }}>
                    <input
                      type="radio"
                      name="syncWeeks"
                      value={item.weeks}
                      checked={syncWeeks === item.weeks}
                      onChange={() => setSyncWeeks(item.weeks)}
                      style={{ display: 'none' }}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isSyncing}
                onClick={() => setShowFixedModal(false)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={isSyncing}
                onClick={handleApplyFixedSchedule}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
                  padding: '10px 24px', fontSize: '14px', fontWeight: '600',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {isSyncing ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px' }} />
                    Đang lưu và tạo lịch...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Lưu & Áp dụng lịch cố định ({syncWeeks} tuần)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE SESSION (SỬA / THÊM LẺ / ĐÁNH DẤU LỚP NGHỈ) MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                {editingSession ? 'Sửa thông tin buổi học' : 'Thêm buổi học lẻ'}
              </h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveSession}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Lớp học *</label>
                  <select className="input" required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                    <option value="">-- Chọn lớp --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Môn học / Nội dung *</label>
                  <input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="VD: Toán" />
                </div>

                <div>
                  <label className="label">Ngày học *</label>
                  <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>

                <div>
                  <label className="label">Phòng học</label>
                  <input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="VD: A101" />
                </div>

                <div>
                  <label className="label">Giờ bắt đầu *</label>
                  <input className="input" type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>

                <div>
                  <label className="label">Giờ kết thúc *</label>
                  <input className="input" type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>

                {/* Mark as Class Off / Holiday Toggle */}
                <div style={{
                  gridColumn: '1 / -1',
                  background: isCancelledSession ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${isCancelledSession ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  padding: '12px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', color: isCancelledSession ? '#dc2626' : '#1e293b' }}>
                    <input
                      type="checkbox"
                      checked={isCancelledSession}
                      onChange={(e) => setIsCancelledSession(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>Hôm nay giáo viên cho lớp nghỉ (Không tính vào buổi học của học sinh)</span>
                  </label>

                  {isCancelledSession && (
                    <div style={{ marginTop: '10px' }}>
                      <input
                        className="input"
                        placeholder="Lý do nghỉ (VD: Nghỉ lễ, Giáo viên bận, Thời tiết xấu...)"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        style={{ fontSize: '13px', borderColor: '#fca5a5' }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Ghi chú thêm</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Ghi chú cho buổi học..."
                    style={{ minHeight: '60px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                {editingSession && (
                  <button type="button" className="btn btn-danger" onClick={() => { handleDeleteSession(editingSession.id); setShowModal(false) }}>
                    <Trash2 size={14} /> Xóa buổi này
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingSession ? 'Lưu thay đổi' : 'Tạo buổi học'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPEAT MODAL (TÙY CHỌN TẠO NHIỀU TUẦN CHO NGÀY CỤ THỂ) */}
      {showRepeatModal && (
        <div className="modal-overlay" onClick={() => setShowRepeatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Tạo lịch lặp lại tùy chọn</h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowRepeatModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateRepeat}>
              <div style={{ marginBottom: '12px' }}>
                <label className="label">Lớp *</label>
                <select className="input" required value={repeatForm.class_id} onChange={(e) => setRepeatForm({ ...repeatForm, class_id: e.target.value })}>
                  <option value="">-- Chọn lớp --</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label className="label">Môn / Nội dung *</label>
                <input className="input" required value={repeatForm.subject} onChange={(e) => setRepeatForm({ ...repeatForm, subject: e.target.value })} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label className="label">Các ngày trong tuần *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {DAYS_OF_WEEK.map(d => (
                    <label key={d.value} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                      background: repeatForm.days.includes(d.value) ? 'var(--primary)' : '#f1f5f9',
                      color: repeatForm.days.includes(d.value) ? 'white' : 'var(--text-primary)',
                      fontSize: '13px', fontWeight: '500', transition: 'all 0.2s'
                    }}>
                      <input type="checkbox" checked={repeatForm.days.includes(d.value)}
                        onChange={(e) => {
                          setRepeatForm({
                            ...repeatForm,
                            days: e.target.checked
                              ? [...repeatForm.days, d.value]
                              : repeatForm.days.filter(v => v !== d.value)
                          })
                        }}
                        style={{ display: 'none' }}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label className="label">Từ ngày</label>
                  <input className="input" type="date" required value={repeatForm.from_date} onChange={(e) => setRepeatForm({ ...repeatForm, from_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Đến ngày</label>
                  <input className="input" type="date" required value={repeatForm.to_date} onChange={(e) => setRepeatForm({ ...repeatForm, to_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Giờ bắt đầu</label>
                  <input className="input" type="time" required value={repeatForm.start_time} onChange={(e) => setRepeatForm({ ...repeatForm, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="label">Giờ kết thúc</label>
                  <input className="input" type="time" required value={repeatForm.end_time} onChange={(e) => setRepeatForm({ ...repeatForm, end_time: e.target.value })} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Phòng</label>
                <input className="input" value={repeatForm.room} onChange={(e) => setRepeatForm({ ...repeatForm, room: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRepeatModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary"><Repeat size={14} /> Tạo lịch</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
