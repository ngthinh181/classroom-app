'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { format, isPast, isToday, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  Calendar, ClipboardCheck, FileText, CheckCircle2,
  Clock, AlertTriangle, ArrowRight, Award, BookOpen, MapPin, Sparkles
} from 'lucide-react'
import { Session, Assignment, Submission, Attendance } from '@/lib/types'

export default function StudentDashboardPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState<{ id: string; name: string; school_year: string }[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([])
  const [pendingAssignments, setPendingAssignments] = useState<(Assignment & { submission?: Submission })[]>([])
  const [recentGraded, setRecentGraded] = useState<Submission[]>([])
  const [attendanceStats, setAttendanceStats] = useState({
    total: 0,
    present: 0,
    rate: 100,
  })

  useEffect(() => {
    if (user) loadDashboardData()
  }, [user])

  async function loadDashboardData() {
    if (!user) return
    setLoading(true)
    const supabase = createClient()
    const todayStr = format(new Date(), 'yyyy-MM-dd')

    // Step 1: Get enrolled classes
    const { data: enrollments } = await supabase
      .from('students_classes')
      .select('classes(id, name, school_year)')
      .eq('student_id', user.id)

    const classList = enrollments
      ?.map((e: any) => e.classes)
      .filter(Boolean) || []
    setClasses(classList)
    const classIds = classList.map((c: any) => c.id)

    if (classIds.length > 0) {
      // Step 2: PARALLEL fetch — all 4 queries at once instead of sequential
      const [sessionsRes, assignmentsRes, submissionsRes, attendanceRes] = await Promise.all([
        supabase
          .from('sessions')
          .select('*, classes(name)')
          .in('class_id', classIds)
          .gte('date', todayStr)
          .order('date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(4),
        supabase
          .from('assignments')
          .select('*, classes(name)')
          .in('class_id', classIds)
          .order('due_date', { ascending: true }),
        supabase
          .from('submissions')
          .select('*')
          .eq('student_id', user.id),
        supabase
          .from('attendance')
          .select('status')
          .eq('student_id', user.id),
      ])

      setUpcomingSessions(sessionsRes.data || [])

      // Process assignments + submissions
      const submissions = submissionsRes.data || []
      const submissionMap = new Map(submissions.map((s: Submission) => [s.assignment_id, s]))

      const pending = (assignmentsRes.data || [])
        .map((a: Assignment) => ({
          ...a,
          submission: submissionMap.get(a.id),
        }))
        .filter((a: any) => !a.submission)
        .slice(0, 4)
      setPendingAssignments(pending)

      // Recent graded
      const graded = submissions
        .filter((s: Submission) => s.graded_at || s.quiz_score !== null)
        .slice(0, 3)

      if (graded.length > 0) {
        const { data: gradedAssignments } = await supabase
          .from('assignments')
          .select('id, title, class_id, classes(name)')
          .in('id', graded.map((g: any) => g.assignment_id))

        const assignMap = new Map((gradedAssignments || []).map((ga: any) => [ga.id, ga]))
        setRecentGraded(
          graded.map((g: any) => ({
            ...g,
            assignments: assignMap.get(g.assignment_id),
          }))
        )
      }

      // Attendance stats
      const attendanceList = attendanceRes.data || []
      if (attendanceList.length > 0) {
        const total = attendanceList.length
        const present = attendanceList.filter((a: any) => a.status === 'present').length
        const rate = Math.round((present / total) * 100)
        setAttendanceStats({ total, present, rate })
      }
    }

    setLoading(false)
  }

  const studentName = profile?.full_name || ''

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: '#64748b', fontSize: '14px' }}>Đang tải thông tin học tập...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
          borderRadius: '20px',
          padding: '28px 24px',
          color: 'white',
          boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)',
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
            }}>
              Cổng Học Sinh 🎓
            </span>
            {classes.length > 0 && (
              <span style={{
                background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)',
                padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
              }}>
                {classes.map(c => c.name).join(', ')}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '8px', lineHeight: 1.2 }}>
            Chào {studentName ? studentName : 'bạn'}! 👋
          </h1>
          <p style={{ fontSize: '14px', color: '#e0e7ff', maxWidth: '600px', lineHeight: 1.5 }}>
            Chúc em một ngày học tập tràn đầy năng lượng! Hãy theo dõi lịch học và hoàn thành các bài tập đúng hạn nhé.
          </p>
        </div>

        {/* Decorative background circle */}
        <div style={{
          position: 'absolute', right: '-40px', bottom: '-40px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.1)', pointerEvents: 'none'
        }} />
      </div>

      {/* Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Attendance card */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '14px',
            background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ClipboardCheck size={26} color="#059669" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Tỷ lệ chuyên cần</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669' }}>
              {attendanceStats.total > 0 ? `${attendanceStats.rate}%` : 'Chưa có'}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {attendanceStats.total > 0 ? `Đã học ${attendanceStats.present}/${attendanceStats.total} buổi` : 'Chưa có buổi học nào'}
            </div>
          </div>
        </div>

        {/* Pending Assignments */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '14px',
            background: pendingAssignments.length > 0 ? '#fff7ed' : '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <FileText size={26} color={pendingAssignments.length > 0 ? '#ea580c' : '#2563eb'} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Bài tập cần nộp</div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: pendingAssignments.length > 0 ? '#ea580c' : '#1e293b' }}>
              {pendingAssignments.length} bài
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {pendingAssignments.length > 0 ? 'Cần hoàn thành' : 'Đã nộp đủ bài'}
            </div>
          </div>
        </div>

        {/* Classes card */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '50px', height: '50px', borderRadius: '14px',
            background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BookOpen size={26} color="#7c3aed" />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Lớp đang tham gia</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#7c3aed' }}>
              {classes.length > 0 ? classes[0].name : 'Chưa xếp lớp'}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {classes.length > 0 ? classes[0].school_year : 'Liên hệ giáo viên'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Sections Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Left Column: Upcoming Schedule */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} color="#4f46e5" />
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Lịch học sắp tới</h2>
            </div>
            <Link
              href="/student/schedule"
              style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Xem tất cả <ArrowRight size={14} />
            </Link>
          </div>

          {upcomingSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
              <Calendar size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: '14px', fontWeight: '500' }}>Hiện không có lịch học sắp tới</p>
              <p style={{ fontSize: '12px' }}>Các buổi học mới sẽ xuất hiện ở đây khi cô giáo tạo lịch.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcomingSessions.map((session) => {
                const sessionDate = parseISO(session.date)
                const isSessionToday = isToday(sessionDate)
                return (
                  <div
                    key={session.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: isSessionToday ? '#eff6ff' : '#f8fafc',
                      border: isSessionToday ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>
                        {session.subject}
                      </span>
                      {isSessionToday && (
                        <span style={{
                          background: '#2563eb', color: 'white', fontSize: '11px',
                          padding: '2px 8px', borderRadius: '12px', fontWeight: '600'
                        }}>
                          Hôm nay
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} color="#64748b" />
                        {session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}
                      </span>
                      <span>
                        📅 {format(sessionDate, 'EEEE, dd/MM', { locale: vi })}
                      </span>
                      {session.room && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} color="#64748b" /> {session.room}
                        </span>
                      )}
                    </div>

                    {session.notes && (
                      <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                        💬 {session.notes}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Pending Assignments & Recent Scores */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Pending assignments */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="#ea580c" />
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Bài tập cần nộp</h2>
              </div>
              <Link
                href="/student/assignments"
                style={{ fontSize: '13px', color: '#4f46e5', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Xem tất cả <ArrowRight size={14} />
              </Link>
            </div>

            {pendingAssignments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 16px', color: '#94a3b8' }}>
                <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                <p style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>Tuyệt vời! Đã hoàn thành hết bài tập</p>
                <p style={{ fontSize: '12px' }}>Không có bài tập nào còn đang chờ nộp.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingAssignments.map((assignment) => {
                  const dueDate = parseISO(assignment.due_date)
                  const isOverdue = isPast(dueDate)

                  return (
                    <div
                      key={assignment.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {assignment.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginTop: '2px' }}>
                          <span style={{ color: isOverdue ? '#dc2626' : '#ea580c', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={12} />
                            Hạn: {format(dueDate, 'dd/MM HH:mm')} {isOverdue && '(Quá hạn)'}
                          </span>
                          {assignment.has_quiz && (
                            <span style={{ background: '#ede9fe', color: '#7c3aed', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600' }}>
                              Trắc nghiệm
                            </span>
                          )}
                        </div>
                      </div>

                      <Link
                        href={`/student/assignments/${assignment.id}`}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0 }}
                      >
                        Làm bài
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Graded / Results */}
          {recentGraded.length > 0 && (
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Award size={20} color="#10b981" />
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>Kết quả bài nộp gần đây</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recentGraded.map((sub) => {
                  const totalScore = (sub.quiz_score || 0) + (sub.manual_score || 0)
                  return (
                    <div
                      key={sub.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: '#166534' }}>
                          {sub.assignments?.title || 'Bài tập'}
                        </div>
                        {sub.feedback && (
                          <div style={{ fontSize: '12px', color: '#15803d', fontStyle: 'italic', marginTop: '2px' }}>
                            Cô nhận xét: &quot;{sub.feedback}&quot;
                          </div>
                        )}
                      </div>

                      <div style={{
                        background: '#15803d', color: 'white', fontWeight: '700',
                        padding: '4px 10px', borderRadius: '8px', fontSize: '14px', flexShrink: 0
                      }}>
                        {totalScore} điểm
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
