'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import toast from 'react-hot-toast'
import {
  UserCheck, Shield, KeyRound, UserPlus, Trash2,
  Lock, CheckCircle2, AlertCircle, Save, X, RefreshCw
} from 'lucide-react'
import type { Profile } from '@/lib/types'

export default function SettingsPage() {
  const { user, profile, refresh } = useAuth()

  // Tabs: 'profile' | 'teachers'
  const [activeTab, setActiveTab] = useState<'profile' | 'teachers'>('profile')

  // Profile edit form
  const [fullName, setFullName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Teachers list
  const [teachers, setTeachers] = useState<Profile[]>([])
  const [loadingTeachers, setLoadingTeachers] = useState(false)

  // Add teacher modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [teacherForm, setTeacherForm] = useState({
    full_name: '',
    username: '',
    password: '',
  })
  const [addingTeacher, setAddingTeacher] = useState(false)

  // Reset password modal for other teacher
  const [resetTarget, setResetTarget] = useState<Profile | null>(null)
  const [resetPasswordInput, setResetPasswordInput] = useState('')
  const [resetting, setResetting] = useState(false)

  // Initialize profile form
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name)
    }
  }, [profile])

  // Load teachers on mount or when tab changes
  useEffect(() => {
    loadTeachers()
  }, [])

  async function loadTeachers() {
    setLoadingTeachers(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })

    setTeachers(data || [])
    setLoadingTeachers(false)
  }

  // Handle saving profile & password
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      toast.error('Họ tên không được để trống')
      return
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        toast.error('Mật khẩu mới phải có tối thiểu 6 ký tự')
        return
      }
      if (newPassword !== confirmPassword) {
        toast.error('Mật khẩu xác nhận không khớp')
        return
      }
    }

    setSavingProfile(true)
    try {
      const res = await fetch('/api/admin/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          password: newPassword ? newPassword.trim() : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi cập nhật thông tin')
        return
      }

      toast.success('Đã cập nhật thông tin thành công!')
      setNewPassword('')
      setConfirmPassword('')
      // Refresh Auth Context so header/sidebar updates instantly
      await refresh()
      await loadTeachers()
    } catch {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setSavingProfile(false)
    }
  }

  // Handle adding new teacher
  async function handleAddTeacher(e: React.FormEvent) {
    e.preventDefault()
    if (!teacherForm.full_name.trim() || !teacherForm.username.trim() || !teacherForm.password) {
      toast.error('Vui lòng điền đầy đủ các mục')
      return
    }

    setAddingTeacher(true)
    try {
      const res = await fetch('/api/admin/create-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teacherForm),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi tạo giáo viên')
        return
      }

      toast.success(`Đã thêm giáo viên: ${teacherForm.full_name}`)
      setShowAddModal(false)
      setTeacherForm({ full_name: '', username: '', password: '' })
      loadTeachers()
    } catch {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setAddingTeacher(false)
    }
  }

  // Handle resetting password for another teacher
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget || !resetPasswordInput) return
    if (resetPasswordInput.length < 6) {
      toast.error('Mật khẩu tối thiểu 6 ký tự')
      return
    }

    setResetting(true)
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: resetTarget.id,
          new_password: resetPasswordInput,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi đặt lại mật khẩu')
        return
      }

      toast.success(`Đã đổi mật khẩu cho ${resetTarget.full_name}`)
      setResetTarget(null)
      setResetPasswordInput('')
    } catch {
      toast.error('Lỗi kết nối máy chủ')
    } finally {
      setResetting(false)
    }
  }

  // Handle deleting teacher
  async function handleDeleteTeacher(t: Profile) {
    if (t.id === user?.id) {
      toast.error('Bạn không thể xóa tài khoản của chính mình')
      return
    }

    if (!confirm(`Bạn chắc chắn muốn xóa quyền quản trị và tài khoản của giáo viên "${t.full_name}"?`)) {
      return
    }

    try {
      const res = await fetch('/api/admin/delete-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: t.id }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Lỗi xóa giáo viên')
        return
      }

      toast.success(`Đã xóa giáo viên ${t.full_name}`)
      loadTeachers()
    } catch {
      toast.error('Lỗi kết nối máy chủ')
    }
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
          Tài khoản & Quản lý Giáo viên
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Tùy chỉnh tên gọi của bạn, đổi mật khẩu và quản lý đội ngũ giáo viên cùng quản lý lớp học.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0',
        marginBottom: '28px', paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('profile')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'profile' ? '3px solid #6366f1' : '3px solid transparent',
            color: activeTab === 'profile' ? '#4f46e5' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <UserCheck size={18} />
          <span>Hồ sơ & Đổi mật khẩu của bạn</span>
        </button>

        <button
          onClick={() => setActiveTab('teachers')}
          style={{
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === 'teachers' ? '3px solid #6366f1' : '3px solid transparent',
            color: activeTab === 'teachers' ? '#4f46e5' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <Shield size={18} />
          <span>Đội ngũ Giáo viên quản trị ({teachers.length})</span>
        </button>
      </div>

      {/* TAB 1: Profile & Password */}
      {activeTab === 'profile' && (
        <div style={{ maxWidth: '640px' }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            padding: '28px',
          }}>
            <form onSubmit={handleSaveProfile}>
              {/* Account Overview Box */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '16px', borderRadius: '12px', background: '#f8fafc',
                border: '1px solid #e2e8f0', marginBottom: '24px'
              }}>
                <div style={{
                  width: '54px', height: '54px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', fontWeight: '800', color: 'white',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}>
                  {fullName?.[0]?.toUpperCase() || 'C'}
                </div>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                    {fullName || 'Chưa đặt tên'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Tên đăng nhập: <strong style={{ color: '#475569' }}>{profile?.username}</strong>
                    &nbsp;•&nbsp; Vai trò: <span style={{ color: '#10b981', fontWeight: '600' }}>Giáo viên quản trị</span>
                  </div>
                </div>
              </div>

              {/* Edit Full Name */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Họ và tên hiển thị của bạn (Ví dụ: Cô Mai, Thầy Nam...) *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  required
                />
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Tên này sẽ xuất hiện trên góc trái thanh Sidebar và hiển thị với học sinh khi giao bài.
                </p>
              </div>

              <div style={{ height: '1px', background: '#e2e8f0', margin: '24px 0' }} />

              {/* Password Section */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <KeyRound size={18} color="#6366f1" />
                  <span style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                    Đổi mật khẩu tài khoản
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                  Để trống nếu bạn không có nhu cầu đổi mật khẩu đăng nhập.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Xác nhận lại mật khẩu mới
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới để xác nhận..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={savingProfile}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    background: '#4f46e5',
                    color: 'white',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: savingProfile ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                    opacity: savingProfile ? 0.7 : 1,
                  }}
                >
                  <Save size={16} />
                  <span>{savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: Teachers Management */}
      {activeTab === 'teachers' && (
        <div>
          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                Danh sách Giáo viên / Quản trị viên
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                Các thầy cô trong danh sách này có toàn quyền tạo lớp, điểm danh, ra đề và chấm bài.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '8px',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
              }}
            >
              <UserPlus size={16} />
              <span>+ Thêm Giáo viên mới</span>
            </button>
          </div>

          {/* Teachers List Table */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}>
            {loadingTeachers ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Đang tải danh sách giáo viên...
              </div>
            ) : teachers.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Chưa có giáo viên nào
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '13px' }}>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Giáo viên</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Tên đăng nhập</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Email đăng nhập</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600' }}>Vai trò</th>
                    <th style={{ padding: '14px 20px', fontWeight: '600', textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((t) => {
                    const isSelf = t.id === user?.id
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '38px', height: '38px', borderRadius: '10px',
                              background: isSelf ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#e2e8f0',
                              color: isSelf ? 'white' : '#475569',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: '700', fontSize: '15px'
                            }}>
                              {t.full_name?.[0]?.toUpperCase() || 'G'}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{t.full_name}</span>
                                {isSelf && (
                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    background: '#e0e7ff',
                                    color: '#4338ca',
                                  }}>
                                    Bạn
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '14px 20px', color: '#334155' }}>
                          <code style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', fontSize: '13px' }}>
                            {t.username}
                          </code>
                        </td>

                        <td style={{ padding: '14px 20px', color: '#64748b', fontSize: '13px' }}>
                          {t.username}@lop.local
                        </td>

                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            background: '#ecfdf5',
                            color: '#059669',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Shield size={12} />
                            <span>Quản trị viên</span>
                          </span>
                        </td>

                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              onClick={() => {
                                setResetTarget(t)
                                setResetPasswordInput('')
                              }}
                              title="Đổi mật khẩu"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                color: '#475569',
                                fontSize: '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <KeyRound size={13} />
                              <span>Đổi MK</span>
                            </button>

                            {!isSelf && (
                              <button
                                onClick={() => handleDeleteTeacher(t)}
                                title="Xóa tài khoản"
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '6px',
                                  border: '1px solid #fecaca',
                                  background: '#fff1f2',
                                  color: '#e11d48',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Trash2 size={13} />
                                <span>Xóa</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Thêm Giáo viên mới */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '16px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#e0e7ff', color: '#4338ca', display: 'flex',
                  alignItems: 'center', justifyContent: 'center'
                }}>
                  <UserPlus size={18} />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                  Thêm Giáo viên Quản trị mới
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTeacher}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                    Họ và tên giáo viên *
                  </label>
                  <input
                    type="text"
                    value={teacherForm.full_name}
                    onChange={(e) => setTeacherForm({ ...teacherForm, full_name: e.target.value })}
                    placeholder="VD: Thầy Nguyễn Văn Hưng"
                    required
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                    Tên đăng nhập (viết liền không dấu) *
                  </label>
                  <input
                    type="text"
                    value={teacherForm.username}
                    onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })}
                    placeholder="VD: thayhung"
                    required
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none'
                    }}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Giáo viên sẽ đăng nhập bằng tên này (hoặc email: <code>{teacherForm.username || '...' }@lop.local</code>)
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                    Mật khẩu khởi tạo *
                  </label>
                  <input
                    type="password"
                    value={teacherForm.password}
                    onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                    placeholder="Tối thiểu 6 ký tự..."
                    required
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    background: 'white', color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={addingTeacher}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px',
                    cursor: addingTeacher ? 'not-allowed' : 'pointer', opacity: addingTeacher ? 0.7 : 1
                  }}
                >
                  {addingTeacher ? 'Đang tạo...' : 'Xác nhận tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Đổi mật khẩu cho giáo viên khác */}
      {resetTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '16px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', padding: '24px',
            width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Đổi mật khẩu cho {resetTarget.full_name}
              </h3>
              <button
                onClick={() => setResetTarget(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                  required
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1',
                    background: 'white', color: '#475569', fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', border: 'none',
                    background: '#4f46e5', color: 'white', fontWeight: '600', fontSize: '13px',
                    cursor: resetting ? 'not-allowed' : 'pointer', opacity: resetting ? 0.7 : 1
                  }}
                >
                  {resetting ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
