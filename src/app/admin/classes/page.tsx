'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import {
  Plus, Edit, Trash2, Users, Search, Upload, Download,
  UserPlus, X, ChevronRight, ChevronLeft, Lock, Unlock, Key,
  AlertTriangle, Ban, GraduationCap, ShieldAlert
} from 'lucide-react'
import type { Class, Profile, StudentClass } from '@/lib/types'
import { getCleanDescription, getDisbandInfo } from '@/lib/schedule-utils'

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [students, setStudents] = useState<(StudentClass & { profiles: Profile })[]>([])
  const [allStudents, setAllStudents] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [showClassModal, setShowClassModal] = useState(false)
  const [showStudentModal, setShowStudentModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingClass, setEditingClass] = useState<Class | null>(null)
  const [editingStudent, setEditingStudent] = useState<Profile | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [classForm, setClassForm] = useState({ name: '', school_year: '', description: '' })
  const [studentForm, setStudentForm] = useState({ full_name: '', username: '', password: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  // Disband Class state
  const [showDisbandModal, setShowDisbandModal] = useState(false)
  const [disbandingClass, setDisbandingClass] = useState<Class | null>(null)
  const [disbandReason, setDisbandReason] = useState('Lớp đã tốt nghiệp / Ra trường')
  const [customReason, setCustomReason] = useState('')
  const [disbandAction, setDisbandAction] = useState<'archive' | 'delete'>('archive')
  const [isDisbanding, setIsDisbanding] = useState(false)
  const [disbandStudentCount, setDisbandStudentCount] = useState(0)

  useEffect(() => { loadClasses() }, [])

  async function loadClasses() {
    const supabase = createClient()
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false })
    setClasses(data || [])
    setLoading(false)
  }

  async function loadStudents(classId: string) {
    const supabase = createClient()
    const { data } = await supabase
      .from('students_classes')
      .select('*, profiles(*)')
      .eq('class_id', classId)
      .order('enrolled_at')
    setStudents((data as any) || [])
  }

  async function loadAllStudents() {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name')
    setAllStudents(data || [])
  }

  async function handleSaveClass(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    if (editingClass) {
      const { error } = await supabase.from('classes').update(classForm).eq('id', editingClass.id)
      if (error) { toast.error('Lỗi cập nhật lớp'); return }
      toast.success('Đã cập nhật lớp')
    } else {
      const { error } = await supabase.from('classes').insert(classForm)
      if (error) { toast.error('Lỗi tạo lớp'); return }
      toast.success('Đã tạo lớp mới')
    }
    setShowClassModal(false)
    setEditingClass(null)
    setClassForm({ name: '', school_year: '', description: '' })
    loadClasses()
  }

  async function handleDeleteClass(id: string) {
    if (!confirm('Xóa lớp này sẽ xóa tất cả dữ liệu liên quan. Bạn chắc chắn?')) return
    const supabase = createClient()
    await supabase.from('classes').delete().eq('id', id)
    toast.success('Đã xóa lớp')
    if (selectedClass?.id === id) setSelectedClass(null)
    loadClasses()
  }

  async function openDisbandModal(cls: Class) {
    setDisbandingClass(cls)
    setDisbandReason('Lớp đã tốt nghiệp / Ra trường')
    setCustomReason('')
    setDisbandAction('archive')
    setShowDisbandModal(true)
    
    // Check student count
    const supabase = createClient()
    const { count } = await supabase
      .from('students_classes')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', cls.id)
    setDisbandStudentCount(count || 0)
  }

  async function handleConfirmDisband() {
    if (!disbandingClass) return
    setIsDisbanding(true)
    const finalReason = disbandReason === 'Khác' ? (customReason.trim() || 'Lý do khác') : disbandReason

    try {
      const res = await fetch('/api/admin/disband-class', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_id: disbandingClass.id,
          reason: finalReason,
          action: disbandAction
        })
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Lỗi khi giải tán lớp')
        setIsDisbanding(false)
        return
      }

      toast.success(`Đã giải tán lớp và khóa ${result.lockedCount} tài khoản học sinh!`)
      setShowDisbandModal(false)
      if (selectedClass?.id === disbandingClass.id) {
        if (disbandAction === 'delete') {
          setSelectedClass(null)
        } else {
          loadStudents(selectedClass.id)
        }
      }
      loadClasses()
    } catch (err: any) {
      toast.error('Lỗi kết nối: ' + err.message)
    } finally {
      setIsDisbanding(false)
    }
  }

  async function handleSaveStudent(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    
    if (editingStudent) {
      // Update existing student profile
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: studentForm.full_name })
        .eq('id', editingStudent.id)
      if (error) { toast.error('Lỗi cập nhật'); return }
      toast.success('Đã cập nhật học sinh')
    } else {
      // Create new student via API
      const res = await fetch('/api/admin/create-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: studentForm.username,
          password: studentForm.password,
          full_name: studentForm.full_name,
          class_id: selectedClass?.id,
        }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error || 'Lỗi tạo học sinh'); return }
      toast.success('Đã tạo học sinh')
    }
    setShowStudentModal(false)
    setEditingStudent(null)
    setStudentForm({ full_name: '', username: '', password: '' })
    if (selectedClass) loadStudents(selectedClass.id)
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedClass) return
    
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(evt.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json<any>(ws)
        
        let success = 0
        let errors = 0
        
        for (const row of data) {
          const fullName = row['Họ tên'] || row['ho_ten'] || row['full_name'] || ''
          const username = row['Tên đăng nhập'] || row['username'] || row['ten_dang_nhap'] || ''
          const password = row['Mật khẩu'] || row['password'] || row['mat_khau'] || '123456'
          
          if (!fullName || !username) { errors++; continue }
          
          const res = await fetch('/api/admin/create-student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username, password, full_name: fullName,
              class_id: selectedClass.id,
            }),
          })
          if (res.ok) success++; else errors++
        }
        
        toast.success(`Đã nhập ${success} học sinh${errors > 0 ? `, ${errors} lỗi` : ''}`)
        setShowImportModal(false)
        loadStudents(selectedClass.id)
      } catch {
        toast.error('Lỗi đọc file. Kiểm tra định dạng.')
      }
    }
    reader.readAsBinaryString(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['Họ tên', 'Tên đăng nhập', 'Mật khẩu'],
      ['Nguyễn Văn A', 'nguyenvana', '123456'],
      ['Trần Thị B', 'tranthib', '123456'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách')
    XLSX.writeFile(wb, 'mau_nhap_hoc_sinh.xlsx')
  }

  async function handleRemoveStudent(studentId: string) {
    if (!selectedClass || !confirm('Xóa học sinh khỏi lớp này?')) return
    const supabase = createClient()
    await supabase.from('students_classes').delete()
      .eq('student_id', studentId).eq('class_id', selectedClass.id)
    toast.success('Đã xóa khỏi lớp')
    loadStudents(selectedClass.id)
  }

  async function handleToggleActive(student: Profile) {
    const supabase = createClient()
    await supabase.from('profiles').update({ is_active: !student.is_active }).eq('id', student.id)
    toast.success(student.is_active ? 'Đã khóa tài khoản' : 'Đã mở tài khoản')
    if (selectedClass) loadStudents(selectedClass.id)
  }

  async function handleResetPassword(studentId: string) {
    const newPass = prompt('Nhập mật khẩu mới:')
    if (!newPass) return
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: studentId, new_password: newPass }),
    })
    if (res.ok) toast.success('Đã đặt lại mật khẩu')
    else toast.error('Lỗi đặt lại mật khẩu')
  }

  async function handleAssignStudent(studentId: string) {
    if (!selectedClass) return
    const supabase = createClient()
    const { error } = await supabase.from('students_classes').insert({
      student_id: studentId, class_id: selectedClass.id,
    })
    if (error) {
      if (error.code === '23505') toast.error('Học sinh đã ở trong lớp này')
      else toast.error('Lỗi gán học sinh')
      return
    }
    toast.success('Đã thêm vào lớp')
    loadStudents(selectedClass.id)
    setShowAssignModal(false)
  }

  const filteredStudents = students.filter(s =>
    s.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="spinner" style={{ width: '32px', height: '32px' }} /></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700' }}>
          {selectedClass ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => setSelectedClass(null)} className="btn btn-ghost" style={{ padding: '6px' }}>
                <ChevronLeft size={20} />
              </button>
              {selectedClass.name}
              <span style={{ fontSize: '14px', fontWeight: '400', color: 'var(--text-secondary)' }}>
                ({selectedClass.school_year})
              </span>
            </span>
          ) : 'Lớp & Học sinh'}
        </h1>
        {!selectedClass ? (
          <button className="btn btn-primary" onClick={() => { setClassForm({ name: '', school_year: '', description: '' }); setEditingClass(null); setShowClassModal(true) }}>
            <Plus size={16} /> Thêm lớp
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => { setStudentForm({ full_name: '', username: '', password: '' }); setEditingStudent(null); setShowStudentModal(true) }}>
              <UserPlus size={16} /> Thêm học sinh
            </button>
            <button className="btn btn-secondary" onClick={() => { loadAllStudents(); setShowAssignModal(true) }}>
              <Users size={16} /> Gán HS có sẵn
            </button>
            <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
              <Upload size={16} /> Nhập Excel
            </button>
            <button
              className="btn btn-secondary"
              style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => openDisbandModal(selectedClass)}
            >
              <AlertTriangle size={16} /> Giải tán lớp
            </button>
          </div>
        )}
      </div>

      {!selectedClass ? (
        /* Classes list */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {classes.length === 0 ? (
            <div className="empty-state card" style={{ gridColumn: '1 / -1' }}>
              <Users size={48} />
              <p>Chưa có lớp nào</p>
              <p style={{ fontSize: '13px' }}>Nhấn &ldquo;Thêm lớp&rdquo; để bắt đầu</p>
            </div>
          ) : classes.map((cls) => {
            const cleanDesc = getCleanDescription(cls.description)
            const disbandInfo = getDisbandInfo(cls.description, cls.name)
            return (
              <div key={cls.id} className="card" style={{
                padding: '20px', cursor: 'pointer',
                borderColor: disbandInfo.is_disbanded ? '#fecaca' : undefined,
                background: disbandInfo.is_disbanded ? '#fffafa' : undefined,
              }}
                onClick={() => { setSelectedClass(cls); loadStudents(cls.id) }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>{cls.name}</h3>
                      {disbandInfo.is_disbanded && (
                        <span className="badge badge-danger" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Ban size={12} /> Đã giải tán
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Năm học: {cls.school_year}</p>
                    {cleanDesc && <p style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>{cleanDesc}</p>}
                    {disbandInfo.is_disbanded && disbandInfo.reason && (
                      <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontStyle: 'italic' }}>
                        Lý do: {disbandInfo.reason}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost" title="Sửa thông tin" style={{ padding: '6px' }} onClick={() => { setEditingClass(cls); setClassForm({ name: cls.name, school_year: cls.school_year, description: getCleanDescription(cls.description) }); setShowClassModal(true) }}>
                      <Edit size={16} />
                    </button>
                    {!disbandInfo.is_disbanded && (
                      <button className="btn btn-ghost" title="Giải tán lớp & Khóa tài khoản" style={{ padding: '6px', color: '#ea580c' }} onClick={() => openDisbandModal(cls)}>
                        <AlertTriangle size={16} />
                      </button>
                    )}
                    <button className="btn btn-ghost" title="Xóa lớp" style={{ padding: '6px', color: 'var(--danger)' }} onClick={() => handleDeleteClass(cls.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', color: 'var(--primary)', fontSize: '13px', fontWeight: '500' }}>
                  <Users size={14} /> Xem danh sách <ChevronRight size={14} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Students list */
        <div>
          {(() => {
            const selDisband = getDisbandInfo(selectedClass.description, selectedClass.name)
            return selDisband.is_disbanded ? (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                padding: '14px 18px', borderRadius: '12px', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <ShieldAlert size={24} style={{ color: '#dc2626', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>
                    Lớp này đã được giải tán / tốt nghiệp
                  </div>
                  <div style={{ fontSize: '13px', color: '#b91c1c', marginTop: '2px' }}>
                    {selDisband.reason ? `Lý do: ${selDisband.reason}. ` : ''}
                    Toàn bộ tài khoản học sinh thuộc lớp này đã bị khóa truy cập hệ thống.
                  </div>
                </div>
              </div>
            ) : null
          })()}
          <div style={{ marginBottom: '16px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            <input className="input" placeholder="Tìm học sinh..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: '40px' }} />
          </div>
          
          {filteredStudents.length === 0 ? (
            <div className="empty-state card">
              <Users size={48} />
              <p>Chưa có học sinh nào trong lớp</p>
            </div>
          ) : (
            <div className="table-container card">
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Họ tên</th>
                    <th>Tên đăng nhập</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((sc, i) => (
                    <tr key={sc.id}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: '500' }}>{sc.profiles?.full_name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{sc.profiles?.username}</td>
                      <td>
                        <span className={`badge ${sc.profiles?.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {sc.profiles?.is_active ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px' }} title="Sửa" onClick={() => { setEditingStudent(sc.profiles!); setStudentForm({ full_name: sc.profiles!.full_name, username: sc.profiles!.username, password: '' }); setShowStudentModal(true) }}>
                            <Edit size={14} />
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px' }} title={sc.profiles?.is_active ? 'Khóa' : 'Mở'} onClick={() => handleToggleActive(sc.profiles!)}>
                            {sc.profiles?.is_active ? <Lock size={14} /> : <Unlock size={14} />}
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px' }} title="Đặt lại mật khẩu" onClick={() => handleResetPassword(sc.profiles!.id)}>
                            <Key size={14} />
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)' }} title="Xóa khỏi lớp" onClick={() => handleRemoveStudent(sc.profiles!.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Class Modal */}
      {showClassModal && (
        <div className="modal-overlay" onClick={() => setShowClassModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{editingClass ? 'Sửa lớp' : 'Thêm lớp mới'}</h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowClassModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveClass}>
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Tên lớp *</label>
                <input className="input" required value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} placeholder="VD: Lớp 5A" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Năm học *</label>
                <input className="input" required value={classForm.school_year} onChange={(e) => setClassForm({ ...classForm, school_year: e.target.value })} placeholder="VD: 2024-2025" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label className="label">Mô tả</label>
                <textarea className="input" rows={3} value={classForm.description} onChange={(e) => setClassForm({ ...classForm, description: e.target.value })} placeholder="Mô tả thêm..." style={{ minHeight: '80px', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowClassModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingClass ? 'Cập nhật' : 'Tạo lớp'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Modal */}
      {showStudentModal && (
        <div className="modal-overlay" onClick={() => setShowStudentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{editingStudent ? 'Sửa học sinh' : 'Thêm học sinh'}</h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowStudentModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveStudent}>
              <div style={{ marginBottom: '16px' }}>
                <label className="label">Họ tên *</label>
                <input className="input" required value={studentForm.full_name} onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })} placeholder="VD: Nguyễn Văn A" />
              </div>
              {!editingStudent && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label className="label">Tên đăng nhập *</label>
                    <input className="input" required value={studentForm.username} onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })} placeholder="VD: nguyenvana" />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label className="label">Mật khẩu *</label>
                    <input className="input" required type="password" value={studentForm.password} onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })} placeholder="Mật khẩu ban đầu" />
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStudentModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary">{editingStudent ? 'Cập nhật' : 'Tạo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Nhập từ Excel/CSV</h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowImportModal(false)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              File cần có các cột: <strong>Họ tên</strong>, <strong>Tên đăng nhập</strong>, <strong>Mật khẩu</strong> (nếu bỏ trống sẽ mặc định 123456)
            </p>
            <button className="btn btn-secondary" onClick={downloadTemplate} style={{ marginBottom: '16px', width: '100%' }}>
              <Download size={16} /> Tải file mẫu
            </button>
            <label className="btn btn-primary" style={{ width: '100%', cursor: 'pointer' }}>
              <Upload size={16} /> Chọn file Excel/CSV
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      )}

      {/* Assign existing student modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Gán học sinh có sẵn</h2>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowAssignModal(false)}><X size={20} /></button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {allStudents.filter(s => !students.some(sc => sc.student_id === s.id)).map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{s.full_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>@{s.username}</div>
                  </div>
                  <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={() => handleAssignStudent(s.id)}>
                    <Plus size={14} /> Thêm
                  </button>
                </div>
              ))}
              {allStudents.filter(s => !students.some(sc => sc.student_id === s.id)).length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '20px' }}>Không có học sinh nào chưa được gán</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disband Class Modal */}
      {showDisbandModal && disbandingClass && (
        <div className="modal-overlay" onClick={() => !isDisbanding && setShowDisbandModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '28px', maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626' }}>
                <ShieldAlert size={24} />
                <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Giải tán lớp học</h2>
              </div>
              <button className="btn btn-ghost" style={{ padding: '4px' }} disabled={isDisbanding} onClick={() => setShowDisbandModal(false)}><X size={20} /></button>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', color: '#991b1b', marginBottom: '6px' }}>
                Lớp: <span style={{ textDecoration: 'underline' }}>{disbandingClass.name}</span> ({disbandingClass.school_year})
              </div>
              <div style={{ fontSize: '13px', color: '#b91c1c', lineHeight: '1.5' }}>
                ⚠️ <strong>Cảnh báo quan trọng:</strong> Khi giải tán lớp, <strong>toàn bộ {disbandStudentCount} tài khoản học sinh</strong> thuộc lớp này sẽ bị <strong>KHÓA NGAY LẬP TỨC</strong>. Học sinh sẽ không thể đăng nhập vào ứng dụng nữa!
              </div>
            </div>

            {/* Reason selector */}
            <div style={{ marginBottom: '20px' }}>
              <label className="label" style={{ fontWeight: '600', marginBottom: '8px' }}>Lý do giải tán *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  'Lớp đã tốt nghiệp / Ra trường',
                  'Lớp ít học sinh quá nên giải tán',
                  'Đã kết thúc khóa học',
                  'Khác'
                ].map((reasonOption) => (
                  <label key={reasonOption} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                    background: disbandReason === reasonOption ? '#f1f5f9' : 'transparent',
                    border: `1px solid ${disbandReason === reasonOption ? 'var(--primary)' : 'var(--border)'}`,
                    fontSize: '14px', fontWeight: disbandReason === reasonOption ? '600' : '400'
                  }}>
                    <input
                      type="radio"
                      name="disbandReason"
                      value={reasonOption}
                      checked={disbandReason === reasonOption}
                      onChange={(e) => setDisbandReason(e.target.value)}
                    />
                    <span>{reasonOption}</span>
                  </label>
                ))}
              </div>

              {disbandReason === 'Khác' && (
                <input
                  className="input"
                  style={{ marginTop: '10px' }}
                  placeholder="Nhập lý do giải tán cụ thể..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
              )}
            </div>

            {/* Action selector */}
            <div style={{ marginBottom: '24px' }}>
              <label className="label" style={{ fontWeight: '600', marginBottom: '8px' }}>Phương thức xử lý lớp</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                  background: disbandAction === 'archive' ? '#eff6ff' : 'transparent',
                  border: `1px solid ${disbandAction === 'archive' ? '#3b82f6' : 'var(--border)'}`,
                }}>
                  <input
                    type="radio"
                    name="disbandAction"
                    value="archive"
                    checked={disbandAction === 'archive'}
                    onChange={() => setDisbandAction('archive')}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a8a' }}>
                      Khóa tài khoản & Đổi trạng thái [Đã giải tán] (Khuyên dùng)
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      Toàn bộ tài khoản học sinh bị khóa. Lớp học và lịch sử điểm danh, bài tập vẫn được lưu trữ để cô giáo tra cứu khi cần.
                    </div>
                  </div>
                </label>

                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: '10px',
                  padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                  background: disbandAction === 'delete' ? '#fff1f2' : 'transparent',
                  border: `1px solid ${disbandAction === 'delete' ? '#f43f5e' : 'var(--border)'}`,
                }}>
                  <input
                    type="radio"
                    name="disbandAction"
                    value="delete"
                    checked={disbandAction === 'delete'}
                    onChange={() => setDisbandAction('delete')}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#9f1239' }}>
                      Khóa tài khoản & Xóa hoàn toàn lớp học
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                      Khóa tài khoản học sinh và xóa vĩnh viễn lớp này khỏi hệ thống.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isDisbanding}
                onClick={() => setShowDisbandModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={isDisbanding}
                onClick={handleConfirmDisband}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isDisbanding ? (
                  <>
                    <div className="spinner" style={{ width: '14px', height: '14px' }} />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <ShieldAlert size={16} />
                    Xác nhận giải tán lớp
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
