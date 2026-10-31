'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import {
  Plus, Edit, Trash2, X, FileText, Upload, Eye, Download,
  ChevronRight, ChevronLeft, ClipboardList, CheckCircle,
  MessageSquare, Copy, Send, ExternalLink, Award, AlertCircle,
  Share2, Users, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  Wand2, Sparkles, HelpCircle
} from 'lucide-react'
import type { Class, Assignment, Question, Submission, Profile } from '@/lib/types'


export default function AssignmentsPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [assignments, setAssignments] = useState<(Assignment & { classes: { name: string } })[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null)
  const [submissions, setSubmissions] = useState<(Submission & { profiles: Profile })[]>([])
  const [classStudents, setClassStudents] = useState<Profile[]>([])
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

  // Zalo Integration States
  const [showZaloModal, setShowZaloModal] = useState(false)
  const [zaloReportMode, setZaloReportMode] = useState<'full' | 'reminder' | 'top'>('full')
  const [zaloGroupLink, setZaloGroupLink] = useState('')
  const [zaloCustomNote, setZaloCustomNote] = useState('Các em chưa nộp bài chú ý hoàn thành và nộp trước hạn nhé!')
  const [zaloWebhookUrl, setZaloWebhookUrl] = useState('')
  const [sendingWebhook, setSendingWebhook] = useState(false)
  const [editableZaloText, setEditableZaloText] = useState('')

  // Smart Quiz Parser States
  const [scanningQuiz, setScanningQuiz] = useState(false)
  const [showSmartScanModal, setShowSmartScanModal] = useState(false)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanAnswerKeyFile, setScanAnswerKeyFile] = useState<File | null>(null)
  const [manualAnswerKeyText, setManualAnswerKeyText] = useState('')
  const [scanScanStats, setScanStats] = useState<{ total: number; withAnswer: number; missing: number } | null>(null)


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

  async function loadSubmissions(assignmentId: string, classId?: string) {
    const supabase = createClient()
    const targetClassId = classId || selectedAssignment?.class_id

    const [subRes, qRes, scRes] = await Promise.all([
      supabase
        .from('submissions')
        .select('*, profiles(id, full_name, username)')
        .eq('assignment_id', assignmentId)
        .order('submitted_at', { ascending: false }),
      supabase
        .from('questions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .order('question_number'),
      targetClassId
        ? supabase
            .from('students_classes')
            .select('profiles(id, full_name, username)')
            .eq('class_id', targetClassId)
        : Promise.resolve({ data: [] })
    ])

    setSubmissions((subRes.data as any) || [])
    setQuestions(qRes.data || [])

    const students = ((scRes.data || []) as any[])
      .map(sc => sc.profiles)
      .filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
    setClassStudents(students)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    let file_url = null
    let file_name = null

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
    if (selectedAssignment) loadSubmissions(selectedAssignment.id, selectedAssignment.class_id)
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
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws) as any[]
        const imported = data.map((row: any, i: number) => ({
          question_number: i + 1,
          content: row['Câu hỏi'] || row['content'] || row['cau_hoi'] || '',
          option_a: row['A'] || row['option_a'] || row['dap_an_a'] || '',
          option_b: row['B'] || row['option_b'] || row['dap_an_b'] || '',
          option_c: row['C'] || row['option_c'] || row['dap_an_c'] || '',
          option_d: row['D'] || row['option_d'] || row['dap_an_d'] || '',
          correct_answer: (row['Đáp án'] || row['correct_answer'] || row['dap_an_dung'] || 'A').toUpperCase().trim() as 'A' | 'B' | 'C' | 'D',
          points: Number(row['Điểm'] || row['points'] || row['diem']) || 1,
        })).filter(q => q.content)
        setQuizQuestions(imported)
        toast.success(`Đã nhập ${imported.length} câu hỏi`)
      }
      reader.readAsBinaryString(file)
    })
    if (quizFileRef.current) quizFileRef.current.value = ''
  }

  async function handleScanSmartQuiz() {
    if (!scanFile) {
      toast.error('Vui lòng chọn file đề (PDF, DOCX, TXT hoặc Excel)')
      return
    }

    setScanningQuiz(true)
    try {
      const formData = new FormData()
      formData.append('file', scanFile)
      if (scanAnswerKeyFile) {
        formData.append('answerKeyFile', scanAnswerKeyFile)
      }
      if (manualAnswerKeyText.trim()) {
        formData.append('manualAnswerKey', manualAnswerKeyText.trim())
      }

      const res = await fetch('/api/admin/parse-quiz', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi quét file đề')
      }

      if (!data.questions || data.questions.length === 0) {
        toast.error('Không tìm thấy câu hỏi trắc nghiệm nào trong file. Vui lòng kiểm tra định dạng.')
        return
      }

      const imported = data.questions.map((q: any, i: number) => ({
        question_number: i + 1,
        content: q.content,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_answer: q.correct_answer,
        points: q.points || 1,
      }))

      setQuizQuestions(imported)
      setForm(prev => ({ ...prev, has_quiz: true }))
      setShowSmartScanModal(false)

      const answerMsg = data.missingAnswersCount > 0
        ? ` (Trong đó ${data.answersFoundCount} câu có sẵn đáp án, ${data.missingAnswersCount} câu cần giáo viên chọn đáp án hoặc nhập file đáp án)`
        : ` (Toàn bộ ${data.answersFoundCount} câu đều được nhận diện đáp án chuẩn xác!)`

      toast.success(`🎉 Quét thành công ${imported.length} câu hỏi!${answerMsg}`, { duration: 6000 })
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || 'Lỗi quét file đề thi')
    } finally {
      setScanningQuiz(false)
    }
  }


  const isPastDue = (d: string) => new Date(d) < new Date()

  // Calculated submission statistics
  const submittedStudentIds = useMemo(() => new Set(submissions.map(s => s.student_id)), [submissions])
  const unsubmittedStudents = useMemo(() => classStudents.filter(cs => !submittedStudentIds.has(cs.id)), [classStudents, submittedStudentIds])
  const submissionRate = classStudents.length > 0 ? Math.round((submissions.length / classStudents.length) * 100) : 0
  const isAllSubmitted = classStudents.length > 0 && unsubmittedStudents.length === 0

  // Calculate scores breakdown
  const scoredSubmissions = useMemo(() => {
    return submissions.map(s => {
      const totalScore = (s.quiz_score || 0) + (s.manual_score || 0)
      return {
        ...s,
        totalScore,
      }
    }).sort((a, b) => b.totalScore - a.totalScore)
  }, [submissions])

  // Open Zalo Modal and generate preview
  function openZaloModal() {
    if (!selectedAssignment) return
    const savedLink = localStorage.getItem(`zalo_group_${selectedAssignment.class_id}`) || ''
    setZaloGroupLink(savedLink)
    generateZaloReport(zaloReportMode, zaloCustomNote)
    setShowZaloModal(true)
  }

  function handleSaveZaloLink(link: string) {
    setZaloGroupLink(link)
    if (selectedAssignment) {
      localStorage.setItem(`zalo_group_${selectedAssignment.class_id}`, link)
    }
  }

  // Generate Zalo Message Text
  function generateZaloReport(mode: 'full' | 'reminder' | 'top', note: string) {
    if (!selectedAssignment) return

    const className = selectedAssignment.classes?.name || 'Lớp'
    const dueFormatted = format(new Date(selectedAssignment.due_date), 'HH:mm dd/MM/yyyy')
    const totalStudents = classStudents.length
    const submittedCount = submissions.length
    const unsubmittedCount = unsubmittedStudents.length

    let text = `📢 THÔNG BÁO BÀI TẬP - ${className.toUpperCase()}
📝 Bài tập: ${selectedAssignment.title}
⏰ Hạn nộp: ${dueFormatted}
📊 Tiến độ: Đã nộp ${submittedCount}/${totalStudents} học sinh (${submissionRate}%)
──────────────────
`

    if (mode === 'reminder') {
      text += `⚠️ CÁC BẠN CHƯA NỘP BÀI (${unsubmittedCount} em):\n`
      if (unsubmittedCount === 0) {
        text += `🎉 Tuyệt vời! Cả lớp đã nộp đủ 100% bài tập!\n`
      } else {
        unsubmittedStudents.forEach((st, idx) => {
          text += `${idx + 1}. ${st.full_name}\n`
        })
      }
      text += `\n💬 Lời nhắn của cô: ${note}\n`
      text += `👉 Link làm và nộp bài online:
https://classroom-web-app-eight.vercel.app`
    } else if (mode === 'top') {
      text += `🏆 VINH DANH TOP ĐIỂM CAO:\n`
      const topList = scoredSubmissions.slice(0, 5)
      topList.forEach((s, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐'
        const scoreStr = s.quiz_score !== null && s.manual_score !== null
          ? `${s.totalScore}đ (TN: ${s.quiz_score}đ, Tự luận: ${s.manual_score}đ)`
          : s.quiz_score !== null ? `${s.quiz_score}đ` : `${s.manual_score || 0}đ`
        text += `${medal} ${idx + 1}. ${s.profiles?.full_name}: ${scoreStr}\n`
      })
      if (unsubmittedCount > 0) {
        text += `\n⚠️ Vẫn còn ${unsubmittedCount} bạn chưa nộp bài. Các em chú ý hoàn thành nhé!\n`
      }
    } else {
      // Full report
      if (isAllSubmitted) {
        text += `🎉 Chúc mừng cả lớp đã hoàn thành nộp bài 100%!\n\n`
      }

      text += `📋 BẢNG ĐIỂM ĐÃ NỘP BÀI (${submittedCount} em):\n`
      scoredSubmissions.forEach((s, idx) => {
        const scoreStr = s.quiz_score !== null && s.manual_score !== null
          ? `${s.totalScore}đ (TN: ${s.quiz_score}đ, TL: ${s.manual_score}đ)`
          : s.quiz_score !== null ? `${s.quiz_score}đ` : s.manual_score !== null ? `${s.manual_score}đ` : 'Chờ chấm'
        text += `${idx + 1}. ${s.profiles?.full_name}: ${scoreStr}\n`
      })

      if (unsubmittedCount > 0) {
        text += `\n⚠️ CÁC BẠN CHƯA NỘP (${unsubmittedCount} em):\n`
        text += unsubmittedStudents.map(s => s.full_name).join(', ') + '\n'
      }

      text += `\n💬 Lời nhắn của cô: ${note}\n`
      text += `👉 Xem chi tiết bài làm tại: https://classroom-web-app-eight.vercel.app`
    }

    setEditableZaloText(text)
  }

  function handleModeChange(mode: 'full' | 'reminder' | 'top') {
    setZaloReportMode(mode)
    generateZaloReport(mode, zaloCustomNote)
  }

  function copyZaloText() {
    navigator.clipboard.writeText(editableZaloText).then(() => {
      toast.success('Đã sao chép tin nhắn Zalo thành công!')
    }).catch(() => {
      toast.error('Không thể copy tự động. Vui lòng bôi đen văn bản để copy.')
    })
  }

  function openZaloGroup() {
    if (!zaloGroupLink.trim()) {
      toast.error('Vui lòng nhập link nhóm Zalo của lớp ở ô bên dưới')
      return
    }
    window.open(zaloGroupLink.trim(), '_blank')
    toast.success('Đang mở nhóm Zalo. Bạn chỉ cần ấn Ctrl + V để gửi tin nhắn!')
  }

  async function handleSendWebhook() {
    if (!zaloWebhookUrl.trim()) {
      toast.error('Vui lòng nhập Webhook URL của nhóm Zalo hoặc Bot')
      return
    }

    setSendingWebhook(true)
    try {
      const res = await fetch(zaloWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editableZaloText })
      })
      if (res.ok) {
        toast.success('Đã tự động gửi tin nhắn vào nhóm Zalo!')
      } else {
        toast.error('Lỗi gửi Webhook: Kiểm tra lại URL')
      }
    } catch {
      toast.error('Lỗi kết nối Webhook')
    } finally {
      setSendingWebhook(false)
    }
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="spinner" style={{ width: '32px', height: '32px' }} /></div>
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>
          {selectedAssignment ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setSelectedAssignment(null)} className="btn btn-ghost" style={{ padding: '6px' }}><ChevronLeft size={20} /></button>
              {selectedAssignment.title}
            </span>
          ) : 'Bài tập'}
        </h1>

        <div style={{ display: 'flex', gap: '10px' }}>
          {selectedAssignment && (
            <button
              onClick={openZaloModal}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                borderRadius: '8px', background: '#0068ff', color: 'white', border: 'none',
                fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 104, 255, 0.3)'
              }}
            >
              <MessageSquare size={16} /> Báo cáo Nhóm Zalo
            </button>
          )}

          {!selectedAssignment && (
            <button className="btn btn-primary" onClick={() => {
              setForm({ class_id: classes[0]?.id || '', title: '', description: '', due_date: format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd'T'HH:mm"), has_quiz: false, show_answers: false })
              setQuizQuestions([]); setUploadFile(null); setEditingId(null); setShowModal(true)
            }}>
              <Plus size={16} /> Tạo bài tập
            </button>
          )}
        </div>
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
                  onClick={() => { setSelectedAssignment(a); loadSubmissions(a.id, a.class_id) }}
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
          {/* Assignment Overview Card */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px', background: 'linear-gradient(135deg, #e0e7ff, #ede9fe)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e1b4b', marginBottom: '6px' }}>
                  {selectedAssignment.title}
                </h2>
                {selectedAssignment.description && <p style={{ fontSize: '14px', marginBottom: '10px', color: '#334155' }}>{selectedAssignment.description}</p>}
                <div style={{ fontSize: '13px', color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>📅 Hạn nộp: <strong>{format(new Date(selectedAssignment.due_date), 'HH:mm dd/MM/yyyy')}</strong></span>
                  {selectedAssignment.file_url && (
                    <a href={selectedAssignment.file_url} target="_blank" rel="noopener" style={{ color: '#4f46e5', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={14} /> {selectedAssignment.file_name || 'Tải file đề bài'}
                    </a>
                  )}
                  {selectedAssignment.has_quiz && <span>📝 Có trắc nghiệm ({questions.length} câu)</span>}
                </div>
              </div>

              {/* Submission Progress Summary */}
              <div style={{
                background: 'white', padding: '12px 18px', borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)', minWidth: '220px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Tiến độ nộp bài:</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: isAllSubmitted ? '#059669' : '#4f46e5' }}>
                    {submissions.length} / {classStudents.length} HS ({submissionRate}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${submissionRate}%`, height: '100%',
                    background: isAllSubmitted ? '#10b981' : '#4f46e5',
                    borderRadius: '4px', transition: 'width 0.3s'
                  }} />
                </div>
                {isAllSubmitted ? (
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: '700', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={13} /> Cả lớp đã nộp đủ 100%!
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#d97706', fontWeight: '600', marginTop: '6px' }}>
                    Còn {unsubmittedStudents.length} học sinh chưa nộp bài
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submissions Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              Danh sách bài đã nộp ({submissions.length})
            </h3>

            {unsubmittedStudents.length > 0 && (
              <button
                onClick={() => {
                  handleModeChange('reminder')
                  openZaloModal()
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                  borderRadius: '6px', background: '#fffbeb', color: '#b45309', border: '1px solid #fef3c7',
                  fontSize: '12px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                <AlertTriangle size={14} color="#d97706" /> Nhắc nhở {unsubmittedStudents.length} bạn chưa nộp
              </button>
            )}
          </div>

          {submissions.length === 0 ? (
            <div className="empty-state card"><ClipboardList size={48} /><p>Chưa có học sinh nào nộp bài</p></div>
          ) : (
            <div className="table-container card" style={{ marginBottom: '24px' }}>
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Học sinh</th>
                    <th>Thời gian nộp</th>
                    <th>File bài làm</th>
                    <th>Điểm TN</th>
                    <th>Điểm tay</th>
                    <th>Tổng điểm</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s, idx) => {
                    const total = (s.quiz_score || 0) + (s.manual_score || 0)
                    return (
                      <tr key={s.id}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: '600', color: '#0f172a' }}>{s.profiles?.full_name}</td>
                        <td style={{ fontSize: '13px' }}>
                          {format(new Date(s.submitted_at), 'dd/MM HH:mm')}
                          {new Date(s.submitted_at) > new Date(selectedAssignment.due_date) && (
                            <span className="badge badge-warning" style={{ marginLeft: '6px' }}>Trễ</span>
                          )}
                        </td>
                        <td>
                          {s.file_url ? (
                            <a href={s.file_url} target="_blank" rel="noopener" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '12px' }}>
                              <Eye size={14} /> Xem file
                            </a>
                          ) : '-'}
                        </td>
                        <td>{s.quiz_score !== null ? <strong>{s.quiz_score}</strong> : '-'}</td>
                        <td>{s.manual_score !== null ? <strong>{s.manual_score}</strong> : '-'}</td>
                        <td>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '13px',
                            background: '#e0e7ff', color: '#4338ca'
                          }}>
                            {s.quiz_score !== null || s.manual_score !== null ? total : '-'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '5px 12px', fontSize: '12px' }}
                            onClick={() => {
                              setShowGradeModal(s)
                              setGradeForm({ manual_score: s.manual_score?.toString() || '', feedback: s.feedback || '' })
                            }}
                          >
                            <Edit size={12} /> Chấm bài
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Unsubmitted Students Section */}
          {unsubmittedStudents.length > 0 && (
            <div style={{
              background: '#fff8f6', border: '1px solid #ffedd5', borderRadius: '16px',
              padding: '20px', marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={18} color="#ea580c" />
                  <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#9a3412' }}>
                    Danh sách học sinh chưa nộp bài ({unsubmittedStudents.length} em)
                  </h4>
                </div>

                <button
                  onClick={() => {
                    handleModeChange('reminder')
                    openZaloModal()
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none',
                    background: '#ea580c', color: 'white', fontWeight: '700', fontSize: '12px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Send size={13} /> Gửi tin Zalo nhắc nhở
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {unsubmittedStudents.map((st, i) => (
                  <div
                    key={st.id}
                    style={{
                      background: 'white', padding: '10px 14px', borderRadius: '8px',
                      border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: '10px'
                    }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px', background: '#ffedd5',
                      color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '700', fontSize: '12px'
                    }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{st.full_name}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>@{st.username}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: BÁO CÁO NHÓM ZALO LỚP HỌC */}
      {showZaloModal && selectedAssignment && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '16px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: '#0068ff', color: 'white', display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                    Gửi Báo cáo Bảng điểm lên Nhóm Zalo
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {selectedAssignment.classes?.name} • {selectedAssignment.title}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowZaloModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={() => handleModeChange('full')}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '8px',
                  border: zaloReportMode === 'full' ? '2px solid #0068ff' : '1px solid #e2e8f0',
                  background: zaloReportMode === 'full' ? '#eff6ff' : 'white',
                  color: zaloReportMode === 'full' ? '#0068ff' : '#475569',
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                📋 Toàn bộ bảng điểm
              </button>

              <button
                onClick={() => handleModeChange('reminder')}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '8px',
                  border: zaloReportMode === 'reminder' ? '2px solid #ea580c' : '1px solid #e2e8f0',
                  background: zaloReportMode === 'reminder' ? '#fff7ed' : 'white',
                  color: zaloReportMode === 'reminder' ? '#ea580c' : '#475569',
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                ⚠️ Nhắc nhở chưa nộp ({unsubmittedStudents.length})
              </button>

              <button
                onClick={() => handleModeChange('top')}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '8px',
                  border: zaloReportMode === 'top' ? '2px solid #059669' : '1px solid #e2e8f0',
                  background: zaloReportMode === 'top' ? '#ecfdf5' : 'white',
                  color: zaloReportMode === 'top' ? '#059669' : '#475569',
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer'
                }}
              >
                🏆 Top điểm cao
              </button>
            </div>

            {/* Teacher's Note Input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                Lời nhắn của cô giáo (đính kèm trong tin nhắn):
              </label>
              <input
                type="text"
                value={zaloCustomNote}
                onChange={e => {
                  setZaloCustomNote(e.target.value)
                  generateZaloReport(zaloReportMode, e.target.value)
                }}
                placeholder="Nhập lời nhắc hoặc dặn dò..."
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: '8px',
                  border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none'
                }}
              />
            </div>

            {/* Editable Preview Box */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                Nội dung tin nhắn xem trước (có thể chỉnh sửa trực tiếp):
              </label>
              <textarea
                value={editableZaloText}
                onChange={e => setEditableZaloText(e.target.value)}
                rows={11}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  fontSize: '13px', lineHeight: '1.5', fontFamily: 'monospace', outline: 'none',
                  background: '#f8fafc'
                }}
              />
            </div>

            {/* Zalo Group Link configuration */}
            <div style={{
              background: '#f1f5f9', padding: '12px 14px', borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                🔗 Link nhóm Zalo của lớp (hệ thống sẽ tự nhớ):
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="VD: https://zalo.me/g/xxxxxx..."
                  value={zaloGroupLink}
                  onChange={e => handleSaveZaloLink(e.target.value)}
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1',
                    fontSize: '13px', outline: 'none'
                  }}
                />
                {zaloGroupLink && (
                  <button
                    onClick={openZaloGroup}
                    style={{
                      padding: '7px 12px', borderRadius: '6px', border: 'none',
                      background: '#0068ff', color: 'white', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <ExternalLink size={13} /> Mở nhóm
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowZaloModal(false)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
                  background: 'white', color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                }}
              >
                Đóng
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                {zaloGroupLink && (
                  <button
                    type="button"
                    onClick={() => {
                      copyZaloText()
                      openZaloGroup()
                    }}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid #0068ff',
                      background: '#eff6ff', color: '#0068ff', fontWeight: '700', fontSize: '13px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Send size={15} /> Copy & Mở nhóm Zalo
                  </button>
                )}

                <button
                  type="button"
                  onClick={copyZaloText}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: '#0068ff', color: 'white', fontWeight: '700', fontSize: '13px',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 2px 8px rgba(0, 104, 255, 0.3)'
                  }}
                >
                  <Copy size={15} /> Sao chép tin nhắn Zalo
                </button>
              </div>
            </div>
          </div>
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
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{
                            fontSize: '12px', padding: '5px 12px',
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
                          }}
                          onClick={() => {
                            setScanFile(uploadFile || null)
                            setShowSmartScanModal(true)
                          }}
                        >
                          <Wand2 size={13} /> ⚡ Quét đề thông minh (PDF/Word/Excel)
                        </button>

                        <label className="btn btn-secondary" style={{ fontSize: '12px', padding: '5px 10px', cursor: 'pointer' }}>
                          <Upload size={12} /> Excel mẫu
                          <input ref={quizFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportQuiz} style={{ display: 'none' }} />
                        </label>
                        <button type="button" className="btn btn-ghost" style={{ fontSize: '12px', padding: '5px 10px', border: '1px solid #cbd5e1' }} onClick={addQuestion}>
                          <Plus size={12} /> Thêm thủ công
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
      {/* MODAL: QUÉT ĐỀ THÔNG MINH (PDF, DOCX, TXT) VÀ ĐÁP ÁN */}
      {showSmartScanModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 110, padding: '16px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Wand2 size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    Quét Đề Trắc Nghiệm Thông Minh
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Tự động nhận diện câu hỏi & đáp án từ file PDF, Word (.docx), hoặc Text
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSmartScanModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Smart Banner Description */}
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
              padding: '14px', marginBottom: '18px', fontSize: '13px', lineHeight: '1.6', color: '#334155'
            }}>
              <div style={{ fontWeight: '700', color: '#4f46e5', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={15} /> Cơ chế nhận diện tự động & linh hoạt:
              </div>
              <ul style={{ paddingLeft: '18px', margin: 0 }}>
                <li>Hệ thống tự động quét câu hỏi (<em>Câu 1:, Câu 2...</em>) và 4 phương án (<em>A., B., C., D.</em>).</li>
                <li><strong>Nếu trong đề có sẵn đáp án</strong> (ví dụ: bôi đậm, gạch chân, hoặc có bảng đáp án ở cuối đề) ➔ Hệ thống sẽ <strong>tự động nhận diện đúng 100%</strong>.</li>
                <li><strong>Nếu đề không có sẵn đáp án</strong> ➔ Bạn có thể tải file đáp án riêng bên dưới hoặc gõ nhanh chuỗi đáp án (ví dụ: <code>1A 2B 3C 4D...</code>).</li>
              </ul>
            </div>

            {/* Step 1: Upload Exam File */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                1. Chọn file đề bài (PDF, DOCX, TXT) *
              </label>
              <div style={{
                border: '2px dashed #cbd5e1', borderRadius: '10px', padding: '16px',
                textAlign: 'center', background: scanFile ? '#eff6ff' : 'white',
                borderColor: scanFile ? '#6366f1' : '#cbd5e1'
              }}>
                <input
                  type="file"
                  id="smart-quiz-file-input"
                  accept=".pdf,.docx,.txt"
                  onChange={e => setScanFile(e.target.files?.[0] || null)}
                  style={{ display: 'none' }}
                />
                <label htmlFor="smart-quiz-file-input" style={{ cursor: 'pointer', display: 'block' }}>
                  <FileText size={28} color={scanFile ? '#4f46e5' : '#94a3b8'} style={{ margin: '0 auto 8px' }} />
                  {scanFile ? (
                    <div>
                      <div style={{ fontWeight: '700', color: '#4f46e5', fontSize: '14px' }}>{scanFile.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{(scanFile.size / 1024).toFixed(1)} KB • Bấm để đổi file khác</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: '600', color: '#334155', fontSize: '14px' }}>Bấm vào đây để chọn file đề thi</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Hỗ trợ PDF, Word (.docx) hoặc file .txt</div>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Step 2: External Answer Key Options */}
            <div style={{
              background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px',
              padding: '16px', marginBottom: '20px'
            }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#b45309', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={15} /> 2. Nhập đáp án riêng (Tùy chọn - nếu trong đề chưa có đáp án):
              </div>
              <p style={{ fontSize: '12px', color: '#92400e', marginBottom: '10px' }}>
                Bạn có thể bỏ trống nếu trong file đề đã có sẵn đáp án hoặc bảng đáp án ở cuối trang.
              </p>

              {/* Way A: Text String */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#78350f', marginBottom: '4px' }}>
                  Cách A: Dán chuỗi đáp án nhanh (ví dụ: 1A 2B 3C 4D hoặc 1.A, 2.B):
                </label>
                <input
                  type="text"
                  placeholder="VD: 1A 2B 3C 4D 5A 6B 7C 8D 9A 10B..."
                  value={manualAnswerKeyText}
                  onChange={e => setManualAnswerKeyText(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fde68a',
                    fontSize: '13px', outline: 'none', background: 'white'
                  }}
                />
              </div>

              {/* Way B: File Answer Key */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#78350f', marginBottom: '4px' }}>
                  Cách B: Hoặc tải file bảng đáp án riêng (PDF/DOCX/TXT/Excel):
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.xlsx,.xls,.csv"
                  onChange={e => setScanAnswerKeyFile(e.target.files?.[0] || null)}
                  style={{ fontSize: '12px', color: '#78350f' }}
                />
                {scanAnswerKeyFile && (
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600', marginTop: '4px' }}>
                    ✓ Đã chọn file đáp án: {scanAnswerKeyFile.name}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSmartScanModal(false)}
                disabled={scanningQuiz}
              >
                Hủy
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleScanSmartQuiz}
                disabled={scanningQuiz || !scanFile}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  border: 'none', padding: '10px 22px', fontSize: '14px', fontWeight: '700',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
                }}
              >
                {scanningQuiz ? (
                  <>
                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                    Đang quét câu hỏi & đáp án...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> Bắt đầu Quét Đề
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

