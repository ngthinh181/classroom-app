'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, addDays, parseISO, isWithinInterval } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Plus, ChevronLeft, ChevronRight, X, Calendar, Repeat, Edit, Trash2 } from 'lucide-react'
import type { Class, Session } from '@/lib/types'
import { DAYS_OF_WEEK } from '@/lib/types'

export default function SchedulePage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [showModal, setShowModal] = useState(false)
  const [showRepeatModal, setShowRepeatModal] = useState(false)
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(() => ({
    class_id: '', subject: '', date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '08:00', end_time: '09:30', room: '', notes: ''
  }))
  const [repeatForm, setRepeatForm] = useState(() => ({
    class_id: '', subject: '', start_time: '08:00', end_time: '09:30',
    room: '', notes: '', days: [] as number[],
    from_date: format(new Date(), 'yyyy-MM-dd'),
    to_date: format(addWeeks(new Date(), 4), 'yyyy-MM-dd')
  }))

  useEffect(() => {
    loadClasses()
  }, [])
  useEffect(() => { loadSessions() }, [currentWeekStart, viewMode])

  async function loadClasses() {
    const supabase = createClient()
    const { data } = await supabase.from('classes').select('*').order('name')
    setClasses(data || [])
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

  async function handleSaveSession(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (editingSession) {
      const { error } = await supabase.from('sessions').update(form).eq('id', editingSession.id)
      if (error) { toast.error('Lỗi cập nhật'); return }
      toast.success('Đã cập nhật buổi học')
    } else {
      const { error } = await supabase.from('sessions').insert(form)
      if (error) { toast.error('Lỗi tạo buổi học'); return }
      toast.success('Đã tạo buổi học')
    }
    setShowModal(false)
    setEditingSession(null)
    loadSessions()
  }

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

  async function handleDeleteSession(id: string) {
    if (!confirm('Xóa buổi học này?')) return
    const supabase = createClient()
    await supabase.from('sessions').delete().eq('id', id)
    toast.success('Đã xóa')
    loadSessions()
  }

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 })
  })

  const getSessionsForDay = (date: Date) =>
    sessions.filter(s => s.date === format(date, 'yyyy-MM-dd'))

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="spinner" style={{ width: '32px', height: '32px' }} /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>Lịch học</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setShowRepeatModal(true)}>
            <Repeat size={16} /> Tạo lặp lại
          </button>
          <button className="btn btn-primary" onClick={() => {
            setForm({ class_id: classes[0]?.id || '', subject: '', date: format(new Date(), 'yyyy-MM-dd'), start_time: '08:00', end_time: '09:30', room: '', notes: '' })
            setEditingSession(null)
            setShowModal(true)
          }}>
            <Plus size={16} /> Thêm buổi học
          </button>
        </div>
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <button className="btn btn-ghost" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, -1))}>
          <ChevronLeft size={20} />
        </button>
        <h2 style={{ fontSize: '16px', fontWeight: '600', minWidth: '200px', textAlign: 'center' }}>
          {format(currentWeekStart, "'Tuần' dd/MM", { locale: vi })} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'dd/MM/yyyy')}
        </h2>
        <button className="btn btn-ghost" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
          <ChevronRight size={20} />
        </button>
        <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 14px' }}
          onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          Hôm nay
        </button>
      </div>

      {/* Week view */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        {weekDays.map((day) => {
          const daySessions = getSessionsForDay(day)
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
          return (
            <div key={day.toISOString()} className="card" style={{
              padding: '12px', minHeight: '120px',
              borderTop: isToday ? '3px solid var(--primary)' : undefined,
            }}>
              <div style={{
                fontSize: '12px', fontWeight: '600',
                color: isToday ? 'var(--primary)' : 'var(--text-secondary)',
                marginBottom: '8px', textTransform: 'uppercase'
              }}>
                {format(day, 'EEEE', { locale: vi })}
                <br />
                <span style={{ fontSize: '16px', fontWeight: '700', color: isToday ? 'var(--primary)' : 'var(--text-primary)' }}>
                  {format(day, 'dd/MM')}
                </span>
              </div>
              {daySessions.map((s) => (
                <div key={s.id} style={{
                  background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)',
                  borderRadius: '8px', padding: '8px', marginBottom: '6px',
                  fontSize: '12px', cursor: 'pointer', position: 'relative'
                }}
                  onClick={() => {
                    setEditingSession(s)
                    setForm({ class_id: s.class_id, subject: s.subject, date: s.date, start_time: s.start_time, end_time: s.end_time, room: s.room || '', notes: s.notes || '' })
                    setShowModal(true)
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '2px' }}>{s.subject}</div>
                  <div style={{ color: 'var(--text-secondary)' }}>{(s as any).classes?.name}</div>
                  <div style={{ color: 'var(--primary)', fontWeight: '500' }}>
                    {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                  </div>
                  {s.room && <div style={{ color: 'var(--text-light)' }}>📍 {s.room}</div>}
                  <button
                    className="btn btn-ghost"
                    style={{ position: 'absolute', top: '4px', right: '4px', padding: '2px' }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id) }}
                  >
                    <Trash2 size={12} color="var(--danger)" />
                  </button>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Single session modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{editingSession ? 'Sửa buổi học' : 'Thêm buổi học'}</h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveSession}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Lớp *</label>
                  <select className="input" required value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                    <option value="">-- Chọn lớp --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Môn / Nội dung *</label>
                  <input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="VD: Toán" />
                </div>
                <div>
                  <label className="label">Ngày *</label>
                  <input className="input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phòng</label>
                  <input className="input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="VD: A101" />
                </div>
                <div>
                  <label className="label">Bắt đầu *</label>
                  <input className="input" type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="label">Kết thúc *</label>
                  <input className="input" type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Ghi chú</label>
                  <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ minHeight: '60px', resize: 'vertical' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                {editingSession && (
                  <button type="button" className="btn btn-danger" onClick={() => { handleDeleteSession(editingSession.id); setShowModal(false) }}>
                    <Trash2 size={14} /> Xóa
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingSession ? 'Cập nhật' : 'Tạo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repeat modal */}
      {showRepeatModal && (
        <div className="modal-overlay" onClick={() => setShowRepeatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Tạo lịch lặp lại</h2>
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
