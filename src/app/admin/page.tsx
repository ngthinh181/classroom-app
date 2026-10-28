'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Calendar, ClipboardCheck, FileText, Users, Clock, AlertTriangle, TrendingUp } from 'lucide-react'
import type { Session, Assignment, Submission } from '@/lib/types'

export default function AdminDashboard() {
  const [todaySessions, setTodaySessions] = useState<(Session & { classes: { name: string } })[]>([])
  const [upcomingAssignments, setUpcomingAssignments] = useState<(Assignment & { classes: { name: string } })[]>([])
  const [ungradedCount, setUngradedCount] = useState(0)
  const [studentCount, setStudentCount] = useState(0)
  const [classCount, setClassCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dateText, setDateText] = useState('')

  useEffect(() => {
    setDateText(format(new Date(), "EEEE, 'ngày' dd 'tháng' MM 'năm' yyyy", { locale: vi }))
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const supabase = createClient()
    const today = format(new Date(), 'yyyy-MM-dd')
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)

    // ALL 5 queries in PARALLEL instead of sequential
    const [sessionsRes, assignmentsRes, ungradedRes, studentsRes, classesRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('*, classes(name)')
        .eq('date', today)
        .order('start_time'),
      supabase
        .from('assignments')
        .select('*, classes(name)')
        .gte('due_date', new Date().toISOString())
        .lte('due_date', nextWeek.toISOString())
        .order('due_date'),
      supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .is('manual_score', null)
        .not('file_url', 'is', null),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student'),
      supabase
        .from('classes')
        .select('*', { count: 'exact', head: true }),
    ])

    setTodaySessions((sessionsRes.data as any) || [])
    setUpcomingAssignments((assignmentsRes.data as any) || [])
    setUngradedCount(ungradedRes.count || 0)
    setStudentCount(studentsRes.count || 0)
    setClassCount(classesRes.count || 0)
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
          Xin chào! 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          {dateText}
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="stat-card gradient-primary">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Calendar size={20} />
            <span style={{ fontSize: '13px', opacity: 0.9 }}>Buổi học hôm nay</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700' }}>{todaySessions.length}</div>
        </div>

        <div className="stat-card gradient-warm">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <FileText size={20} />
            <span style={{ fontSize: '13px', opacity: 0.9 }}>Bài sắp hết hạn</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700' }}>{upcomingAssignments.length}</div>
        </div>

        <div className="stat-card gradient-cool">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <ClipboardCheck size={20} />
            <span style={{ fontSize: '13px', opacity: 0.9 }}>Bài chưa chấm</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700' }}>{ungradedCount}</div>
        </div>

        <div className="stat-card gradient-success">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Users size={20} />
            <span style={{ fontSize: '13px', opacity: 0.9 }}>Học sinh / Lớp</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700' }}>{studentCount} / {classCount}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
        {/* Today's sessions */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Clock size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Lịch học hôm nay</h2>
          </div>
          {todaySessions.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <Calendar size={40} />
              <p style={{ fontSize: '14px' }}>Không có buổi học nào hôm nay</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {todaySessions.map((session) => (
                <div key={session.id} style={{
                  padding: '14px', borderRadius: '12px', background: '#f8fafc',
                  border: '1px solid var(--border)', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
                      {session.subject}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {session.classes?.name} {session.room ? `• ${session.room}` : ''}
                    </div>
                  </div>
                  <div className="badge badge-info">
                    {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming assignments */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <h2 style={{ fontSize: '16px', fontWeight: '600' }}>Bài tập sắp hết hạn</h2>
          </div>
          {upcomingAssignments.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px' }}>
              <FileText size={40} />
              <p style={{ fontSize: '14px' }}>Không có bài tập nào sắp đến hạn</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcomingAssignments.map((a) => (
                <div key={a.id} style={{
                  padding: '14px', borderRadius: '12px', background: '#f8fafc',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>
                    {a.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{a.classes?.name}</span>
                    <span className="badge badge-warning">
                      Hạn: {format(new Date(a.due_date), 'dd/MM HH:mm')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
