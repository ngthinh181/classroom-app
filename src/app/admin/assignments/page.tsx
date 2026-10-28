'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  Plus, Edit, Trash2, X, FileText, Upload, Eye, Download,
  ChevronRight, ChevronLeft, ClipboardList, CheckCircle
} from 'lucide-react'
import type { Class, Assignment, Question, Submission, Profile } from '@/lib/types'

export default function AssignmentsPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [assignments, setAssignments] = useState<(Assignment & { classes: { name: string } })[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<(Submission & { profiles: Profile })[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showQuizModal, setShowQuizModal] = useState(false)
  const [showGradeModal, setShowGradeModal] = useState<Submission | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterClass, setFilterClass] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const quizFileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    class_id: '', title: '', description: '', due_date: '',
    has_quiz: false, show_answers: false,
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [quizQuestions, setQuizQuestions] = useState<Omit<Question, 'id' | 'assignment_id' | 'created_at'>[]>([])
  const [gradeForm, setGradeForm] = useState({ manual_score: '', feedback: '' })

  useEffect(() => {
    loadClasses()
  }, [])

  useEffect(() => {
    loadAssignments()
  }, [filterClass])

  async function loadClasses() {
    const supabase = createClient()
    const { data } = await supabase.from('classes').select('*').order('name')
    setClasses(data || [])
  }

  async function loadAssignments() {
    const supabase = createClient()
    let query = supabase.from('assignments').select('*, classes(name)').order('due_date', { ascending: false })
    if (filterClass) query = query.eq('class_id', filterClass)
    const { data } = await query
    setAssignments((data as any) || [])
    setLoading(false)
  }

  async function loadSubmissions(assignmentId: string) {
    const supabase = createClient()
    const [subRes, qRes] = await Promise.all([
      supabase
        .from('submissions')
        .select('*, profiles(full_name, username)')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('question_number')
    ])
    setSubmissions((subRes.data as any) || [])
    setQuestions(qRes.data || [])
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    let file_url = null
    let file_name = null

    // Upload file if provided
    if (uploadFile) {
      const ext = uploadFile.name.split('.').pop()
      const path = `assignments/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('assignments').upload(path, uploadFile)
      if (uploadError) { toast.error('Lỗi tải file'); return }
      const { data: urlData } = supabase.storage.from('assignments').getPublicUrl(path)
      file_url = urlData.publicUrl
      file_name = uploadFile.name
    }

    const payload: any = { ...form }
    if (file_url) { payload.file_url = file_url; payload.file_name = file_name }

    if (editingId) {
      const { error } = await supabase.from('assignments').update(payload).eq('id', editingId)
      if (error) { toast.error('Lỗi cập nhật'); return }
      toast.success('Đã cập nhật bài tập')
    } else {
      const { data: created, error } = await supabase.from('assignments').insert(payload).select().single()
      if (error) { toast.error('Lỗi tạo bài tập'); return }

      // Save quiz questions if any
      if (form.has_quiz && quizQuestions.length > 0 && created) {
        const qs = quizQuestions.map((q, i) => ({ ...q, assignment_id: created.id, question_number: i + 1 }))
        await supabase.from('questions').insert(qs)
      }
      toast.success('Đã tạo bài tập')
    }
    setShowModal(false)
    setUploadFile(null)
    setEditingId(null)
    loadAssignments()
  }

  async function handleDelete(id: string) {
    if (!confirm('Xóa bài tập này?')) return
    const supabase = createClient()
    await supabase.from('assignments').delete().eq('id', id)
    toast.success('Đã xóa')
    if (selectedAssignment?.id === id) setSelectedAssignment(null)
    loadAssignments()
  }

  async function handleGrade(e: React.FormEvent) {
    e.preventDefault()
    if (!showGradeModal) return
    const supabase = createClient()
    const { error } = await supabase.from('submissions').update({
      manual_score: gradeForm.manual_score ? parseFloat(gradeForm.manual_score) : null,
      feedback: gradeForm.feedback || null,
      graded_at: new Date().toISOString(),
    }).eq('id', showGradeModal.id)
    if (error) { toast.error('Lỗi chấm bài'); return }
    toast.success('Đã chấm bài')
    setShowGradeModal(null)
    if (selectedAssignment) loadSubmissions(selectedAssignment.id)
  }

  function addQuestion() {
    setQuizQuestions([...quizQuestions, {
      question_number: quizQuestions.length + 1, content: '',
      option_a: '', option_b: '', option_c: '', option_d: '',
      correct_answer: 'A' as const, points: 1,
    }])
  }

  function handleImportQuiz(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    import('xlsx').then(XLSX => {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<any>(ws)
        const imported = data.map((row: any, i: number) => ({
          question_number: i + 1,
          content: row['Câu hỏi'] || row['content'] || '',
          option_a: String(row['A'] || row['option_a'] || ''),
          option_b: String(row['B'] || row['option_b'] || ''),
          option_c: String(row['C'] || row['option_c'] || ''),
          option_d: String(row['D'] || row['option_d'] || ''),
          correct_answer: (String(row['Đáp án'] || row['correct_answer'] || 'A').toUpperCase()) as 'A' | 'B' | 'C' | 'D',
          points: Number(row['Điểm'] || row['points'] || 1),
        }))
        setQuizQuestions(imported)
        toast.success(`Đã nhập ${imported.length} câu hỏi`)
      }
      reader.readAsBinaryString(file)
    })
    if (quizFileRef.current) quizFileRef.current.value = ''
  }

  function parseQuizText(text: string) {
    const lines = text.trim().split('\n')
    const parsed: typeof quizQuestions = []
    let current: any = null
    for (const line of lines) {
      const qMatch = line.match(/^(?:Câu\s*)?(\d+)[.):]\s*(.+)/)
      const aMatch = line.match(/^([A-D])[.):]\s*(.+)/i)
      const ansMatch = line.match(/^(?:Đáp án|DA)[.:)]\s*([A-D])/i)
      if (qMatch) {
        if (current) parsed.push(current)
        current = { question_number: parsed.length + 1, content: qMatch[2], option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A' as const, points: 1 }
      } else if (aMatch && current) {
        const key = `option_${aMatch[1].toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'
        current[key] = aMatch[2]
      } else if (ansMatch && current) {
        current.correct_answer = ansMatch[1].toUpperCase()
      }
    }
    if (current) parsed.push(current)
    return parsed
  }

  const isPastDue = (d: string) => new Date(d) < new Date()

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="spinner" style={{ width: '32px', height: '32px' }} /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>
          {selectedAssignment ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setSelectedAssignment(null)} className="btn btn-ghost" style={{ padding: '6px' }}><ChevronLeft size={20} /></button>
              {selectedAssignment.title}
            </span>
          ) : 'Bài tập'}
        </h1>
        {!selectedAssignment && (
          <button className="btn btn-primary" onClick={() => {
            setForm({ class_id: classes[0]?.id || '', title: '', description: '', due_date: format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd'T'HH:mm"), has_quiz: false, show_answers: false })
            setQuizQuestions([]); setUploadFile(null); setEditingId(null); setShowModal(true)
          }}>
            <Plus size={16} /> Tạo bài tập
          </button>
        )}
      </div>

      {!selectedAssignment ? (
        <>
          <div style={{ marginBottom: '16px' }}>
            <select className="input" style={{ maxWidth: '300px' }} value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
              <option value="">Tất cả lớp</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {assignments.length === 0 ? (
            <div className="empty-state card"><FileText size={48} /><p>Chưa có bài tập</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {assignments.map(a => (
                <div key={a.id} className="card" style={{ padding: '18px', cursor: 'pointer' }}
                  onClick={() => { setSelectedAssignment(a); loadSubmissions(a.id) }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', fontSize: '16px' }}>{a.title}</span>
                        {a.has_quiz && <span className="badge badge-info">Trắc nghiệm</span>}
                        {isPastDue(a.due_date) && <span className="badge badge-danger">Hết hạn</span>}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {a.classes?.name} • Hạn nộp: {format(new Date(a.due_date), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-ghost" style={{ padding: '6px' }} onClick={() => {
                        setEditingId(a.id)
                        setForm({ class_id: a.class_id, title: a.title, description: a.description || '', due_date: a.due_date.slice(0, 16), has_quiz: a.has_quiz, show_answers: a.show_answers })
                        setUploadFile(null); setShowModal(true)
                      }}><Edit size={16} /></button>
                      <button className="btn btn-ghost" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => handleDelete(a.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Submissions view */
        <div>
          <div className="card" style={{ padding: '16px', marginBottom: '16px', background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)' }}>
            {selectedAssignment.description && <p style={{ fontSize: '14px', marginBottom: '8px' }}>{selectedAssignment.description}</p>}
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span>📅 Hạn nộp: {format(new Date(selectedAssignment.due_date), 'dd/MM/yyyy HH:mm')}</span>
              {selectedAssignment.file_url && (
                <a href={selectedAssignment.file_url} target="_blank" rel="noopener" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Download size={14} /> {selectedAssignment.file_name || 'Tải đề'}
                </a>
              )}
              {selectedAssignment.has_quiz && <span>📝 Có trắc nghiệm ({questions.length} câu)</span>}
            </div>
          </div>

          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Danh sách bài nộp</h3>
          {submissions.length === 0 ? (
            <div className="empty-state card"><ClipboardList size={48} /><p>Chưa có bài nộp</p></div>
          ) : (
            <div className="table-container card">
              <table>
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Thời gian nộp</th>
                    <th>File bài</th>
                    <th>Điểm TN</th>
                    <th>Điểm tay</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: '500' }}>{s.profiles?.full_name}</td>
                      <td style={{ fontSize: '13px' }}>
                        {format(new Date(s.submitted_at), 'dd/MM HH:mm')}
                        {new Date(s.submitted_at) > new Date(selectedAssignment.due_date) && (
                          <span className="badge badge-warning" style={{ marginLeft: '6px' }}>Trễ</span>
                        )}
                      </td>
                      <td>
                        {s.file_url ? (
                          <a href={s.file_url} target="_blank" rel="noopener" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }}>
                            <Eye size={14} /> Xem
                          </a>
                        ) : '-'}
                      </td>
                      <td>{s.quiz_score !== null ? s.quiz_score : '-'}</td>
                      <td>{s.manual_score !== null ? s.manual_score : '-'}</td>
                      <td>
                        <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }}
                          onClick={() => { setShowGradeModal(s); setGradeForm({ manual_score: s.manual_score?.toString() || '', feedback: s.feedback || '' }) }}>
                          <Edit size={12} /> Chấm
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Assignment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '24px', maxWidth: '700px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{editingId ? 'Sửa bài tập' : 'Tạo bài tập mới'}</h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label className="label">Lớp *</label>
                  <select className="input" required value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })}>
                    <option value="">-- Chọn lớp --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Tiêu đề *</label>
                  <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="label">Mô tả</label>
                  <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: '80px', resize: 'vertical' }} />
                </div>
                <div>
                  <label className="label">Hạn nộp *</label>
                  <input className="input" type="datetime-local" required value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">File đề (PDF/DOC/DOCX)</label>
                  <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={e => setUploadFile(e.target.files?.[0] || null)}
                    className="input" style={{ padding: '8px' }} />
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    <input type="checkbox" checked={form.has_quiz} onChange={e => setForm({ ...form, has_quiz: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                    Có phần trắc nghiệm
                  </label>
                  {form.has_quiz && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                      <input type="checkbox" checked={form.show_answers} onChange={e => setForm({ ...form, show_answers: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }} />
                      Hiện đáp án sau nộp
                    </label>
                  )}
                </div>

                {form.has_quiz && !editingId && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Câu hỏi trắc nghiệm ({quizQuestions.length})</h3>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <label className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 10px', cursor: 'pointer' }}>
                          <Upload size={12} /> Nhập Excel
                          <input ref={quizFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportQuiz} style={{ display: 'none' }} />
                        </label>
                        <button type="button" className="btn btn-primary" style={{ fontSize: '12px', padding: '4px 10px' }} onClick={addQuestion}>
                          <Plus size={12} /> Thêm câu
                        </button>
                      </div>
                    </div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {quizQuestions.map((q, i) => (
                        <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <strong>Câu {i + 1}</strong>
                            <button type="button" className="btn btn-ghost" style={{ padding: '2px', color: 'var(--danger)' }}
                              onClick={() => setQuizQuestions(quizQuestions.filter((_, j) => j !== i))}><X size={14} /></button>
                          </div>
                          <input className="input" placeholder="Nội dung câu hỏi" value={q.content}
                            onChange={e => { const u = [...quizQuestions]; u[i].content = e.target.value; setQuizQuestions(u) }}
                            style={{ marginBottom: '6px', fontSize: '13px' }} />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            {(['A', 'B', 'C', 'D'] as const).map(opt => (
                              <input key={opt} className="input" placeholder={`Đáp án ${opt}`}
                                value={q[`option_${opt.toLowerCase()}` as keyof typeof q] as string}
                                onChange={e => { const u = [...quizQuestions]; (u[i] as any)[`option_${opt.toLowerCase()}`] = e.target.value; setQuizQuestions(u) }}
                                style={{ fontSize: '13px' }} />
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                            <span>Đáp án đúng:</span>
                            {(['A', 'B', 'C', 'D'] as const).map(opt => (
                              <button key={opt} type="button"
                                className={`btn ${q.correct_answer === opt ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '4px 10px', fontSize: '12px', minHeight: '28px' }}
                                onClick={() => { const u = [...quizQuestions]; u[i].correct_answer = opt; setQuizQuestions(u) }}>
                                {opt}
                              </button>
                            ))}
                            <span style={{ marginLeft: 'auto' }}>Điểm:</span>
                            <input className="input" type="number" step="0.5" min="0" value={q.points}
                              onChange={e => { const u = [...quizQuestions]; u[i].points = Number(e.target.value); setQuizQuestions(u) }}
                              style={{ width: '60px', fontSize: '13px', minHeight: '28px', padding: '4px 8px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Cập nhật' : 'Tạo bài tập'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grade Modal */}
      {showGradeModal && (
        <div className="modal-overlay" onClick={() => setShowGradeModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Chấm bài - {showGradeModal.profiles?.full_name}</h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowGradeModal(null)}><X size={20} /></button>
            </div>
            {showGradeModal.file_url && (
              <a href={showGradeModal.file_url} target="_blank" rel="noopener" className="btn btn-secondary" style={{ marginBottom: '16px', width: '100%' }}>
                <Eye size={16} /> Xem bài làm
              </a>
            )}
            {showGradeModal.quiz_score !== null && (
              <div style={{ padding: '12px', background: '#e0e7ff', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
                <strong>Điểm trắc nghiệm tự động:</strong> {showGradeModal.quiz_score}
              </div>
            )}
            <form onSubmit={handleGrade}>
              <div style={{ marginBottom: '12px' }}>
                <label className="label">Điểm (thang 10)</label>
                <input className="input" type="number" step="0.5" min="0" max="10" value={gradeForm.manual_score}
                  onChange={e => setGradeForm({ ...gradeForm, manual_score: e.target.value })} placeholder="Nhập điểm..." />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label className="label">Nhận xét</label>
                <textarea className="input" rows={3} value={gradeForm.feedback}
                  onChange={e => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                  style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Nhận xét cho học sinh..." />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowGradeModal(null)}>Hủy</button>
                <button type="submit" className="btn btn-primary"><CheckCircle size={14} /> Lưu điểm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
