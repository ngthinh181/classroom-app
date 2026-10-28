'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import Link from 'next/link'
import { format, isPast, differenceInHours, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  FileText, Clock, CheckCircle2, AlertTriangle,
  Award, Download, ArrowRight, BookOpen, Check
} from 'lucide-react'
import { Assignment, Submission } from '@/lib/types'

interface AssignmentWithSubmission extends Assignment {
  submission?: Submission
}

export default function StudentAssignmentsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<AssignmentWithSubmission[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'submitted' | 'graded' | 'overdue'>('all')

  useEffect(() => {
    if (user) loadAssignments()
  }, [user])

  async function loadAssignments() {
    if (!user) return
    setLoading(true)
    const supabase = createClient()

    // Step 1: Get enrolled classes
    const { data: enrollments } = await supabase
      .from('students_classes')
      .select('class_id')
      .eq('student_id', user.id)

    const classIds = enrollments?.map((e: any) => e.class_id) || []

    if (classIds.length > 0) {
      // PARALLEL: Fetch assignments and submissions at the same time
      const [assignRes, subRes] = await Promise.all([
        supabase
          .from('assignments')
          .select('*, classes(name)')
          .in('class_id', classIds)
          .order('due_date', { ascending: true }),
        supabase
          .from('submissions')
          .select('*')
          .eq('student_id', user.id),
      ])

      const subMap = new Map((subRes.data || []).map((s: Submission) => [s.assignment_id, s]))

      const combined: AssignmentWithSubmission[] = (assignRes.data || []).map((a: Assignment) => ({
        ...a,
        submission: subMap.get(a.id),
      }))

      setAssignments(combined)
    } else {
      setAssignments([])
    }

    setLoading(false)
  }

  // Filter based on active tab
  const filteredAssignments = assignments.filter((a) => {
    const isSubmitted = !!a.submission
    const isGraded = !!(a.submission?.graded_at || (a.submission?.quiz_score !== null && a.submission?.quiz_score !== undefined))
    const isOverdue = !isSubmitted && isPast(parseISO(a.due_date))

    if (activeTab === 'pending') return !isSubmitted && !isOverdue
    if (activeTab === 'submitted') return isSubmitted && !isGraded
    if (activeTab === 'graded') return isGraded
    if (activeTab === 'overdue') return isOverdue
    return true
  })

  // Quick counters
  const countPending = assignments.filter(a => !a.submission && !isPast(parseISO(a.due_date))).length
  const countSubmitted = assignments.filter(a => !!a.submission && !a.submission.graded_at && a.submission.quiz_score === null).length
  const countGraded = assignments.filter(a => a.submission?.graded_at || (a.submission?.quiz_score !== null && a.submission?.quiz_score !== undefined)).length
  const countOverdue = assignments.filter(a => !a.submission && isPast(parseISO(a.due_date))).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>Danh sách bài tập</h1>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Theo dõi thời hạn, làm bài trắc nghiệm và nộp bài tự luận
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        {[
          { id: 'all', label: 'Tất cả', count: assignments.length },
          { id: 'pending', label: 'Cần làm', count: countPending, color: '#ea580c' },
          { id: 'submitted', label: 'Đã nộp', count: countSubmitted, color: '#2563eb' },
          { id: 'graded', label: 'Đã có điểm', count: countGraded, color: '#059669' },
          { id: 'overdue', label: 'Quá hạn', count: countOverdue, color: '#dc2626' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '6px',
              background: activeTab === tab.id ? '#1e293b' : '#f1f5f9',
              color: activeTab === tab.id ? '#fff' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            <span>{tab.label}</span>
            <span style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '10px',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
              color: activeTab === tab.id ? '#fff' : (tab.color || '#64748b')
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Assignment List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Đang tải bài tập...
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
            Không có bài tập nào
          </h3>
          <p style={{ fontSize: '13px' }}>Không có bài tập trong mục này.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredAssignments.map((assignment) => {
            const dueDate = parseISO(assignment.due_date)
            const isOverdue = isPast(dueDate)
            const hoursLeft = differenceInHours(dueDate, new Date())
            const isNearDeadline = !isOverdue && hoursLeft <= 24 && hoursLeft >= 0

            const isSubmitted = !!assignment.submission
            const totalScore = (assignment.submission?.quiz_score || 0) + (assignment.submission?.manual_score || 0)
            const hasScore = assignment.submission?.graded_at || (assignment.submission?.quiz_score !== null && assignment.submission?.quiz_score !== undefined)

            return (
              <div
                key={assignment.id}
                className="card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  borderTop: isOverdue && !isSubmitted ? '4px solid #ef4444' : isNearDeadline && !isSubmitted ? '4px solid #f59e0b' : '4px solid #6366f1'
                }}
              >
                <div>
                  {/* Badges row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                    {assignment.classes?.name && (
                      <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px' }}>
                        {assignment.classes.name}
                      </span>
                    )}

                    {assignment.has_quiz && (
                      <span style={{ background: '#ede9fe', color: '#7c3aed', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px' }}>
                        Trắc nghiệm online
                      </span>
                    )}

                    {assignment.file_url && (
                      <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px' }}>
                        File đính kèm
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '8px', lineHeight: 1.3 }}>
                    {assignment.title}
                  </h3>

                  {/* Description preview */}
                  {assignment.description && (
                    <p style={{
                      fontSize: '13px', color: '#64748b', lineHeight: 1.4, marginBottom: '12px',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {assignment.description}
                    </p>
                  )}

                  {/* Deadline status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                    <Clock size={14} color={isOverdue && !isSubmitted ? '#dc2626' : isNearDeadline && !isSubmitted ? '#d97706' : '#64748b'} />
                    <span>Hạn nộp: </span>
                    <strong style={{
                      color: isOverdue && !isSubmitted ? '#dc2626' : isNearDeadline && !isSubmitted ? '#d97706' : '#1e293b'
                    }}>
                      {format(dueDate, 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </strong>
                    {isOverdue && !isSubmitted && (
                      <span style={{ color: '#dc2626', fontWeight: '700' }}>(Quá hạn)</span>
                    )}
                    {isNearDeadline && !isSubmitted && (
                      <span style={{ color: '#d97706', fontWeight: '700' }}>(Sắp hết hạn!)</span>
                    )}
                  </div>
                </div>

                {/* Submission & Score footer */}
                <div style={{
                  paddingTop: '14px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    {isSubmitted ? (
                      hasScore ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            background: '#dcfce7', color: '#15803d',
                            fontSize: '12px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px'
                          }}>
                            {totalScore} điểm
                          </span>
                        </div>
                      ) : (
                        <span style={{
                          background: '#eff6ff', color: '#1d4ed8',
                          fontSize: '12px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px'
                        }}>
                          Đã nộp bài
                        </span>
                      )
                    ) : (
                      <span style={{
                        background: '#fef3c7', color: '#b45309',
                        fontSize: '12px', fontWeight: '600', padding: '3px 8px', borderRadius: '6px'
                      }}>
                        Chưa nộp
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/student/assignments/${assignment.id}`}
                    className={isSubmitted ? 'btn btn-secondary' : 'btn btn-primary'}
                    style={{ padding: '6px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {isSubmitted ? 'Xem bài làm' : 'Làm bài ngay'}
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
