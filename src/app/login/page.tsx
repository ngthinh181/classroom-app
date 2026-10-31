'use client'

import { useState, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Eye, EyeOff, LogIn } from 'lucide-react'

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  const errorParam = searchParams.get('error')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const cleanUsername = username.trim()
    const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@lop.local`

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      setError('Tên đăng nhập hoặc mật khẩu không đúng')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', authData.user.id)
      .single()

    if (profile && profile.role !== 'admin' && profile.is_active === false) {
      await supabase.auth.signOut()
      setError('Tài khoản của bạn đã bị khóa do lớp đã tốt nghiệp hoặc giải tán. Vui lòng liên hệ giáo viên.')
      setLoading(false)
      return
    }

    if (profile?.role === 'admin') {
      window.location.href = '/admin'
    } else {
      window.location.href = '/student'
    }
  }

  return (
    <div className="animate-fade-in" style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '40px',
      width: '100%',
      maxWidth: '440px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      position: 'relative',
      zIndex: 1
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '20px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)'
        }}>
          <BookOpen size={32} color="white" />
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>
          Quản lý lớp học
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Đăng nhập để vào hệ thống
        </p>
      </div>

      {/* Error message */}
      {(error || errorParam) && (
        <div style={{
          background: '#fee2e2', color: '#991b1b', padding: '12px 16px',
          borderRadius: '12px', fontSize: '14px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <span>
            {error || (errorParam === 'account_disabled'
              ? 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ cô giáo.'
              : 'Đã xảy ra lỗi. Vui lòng thử lại.')}
          </span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
            Tên đăng nhập
          </label>
          <input
            type="text"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
            placeholder="Ví dụ: nguyenvana hoặc admin"
            required
            autoComplete="username"
            style={{ fontSize: '15px' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
            Mật khẩu
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
              autoComplete="current-password"
              style={{ fontSize: '15px', paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', color: '#94a3b8',
                padding: '4px'
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: '100%', fontSize: '16px', minHeight: '48px' }}
        >
          {loading ? (
            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
          ) : (
            <>
              <LogIn size={18} />
              Đăng nhập
            </>
          )}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '24px' }}>
        Tài khoản do cô giáo cấp. Liên hệ cô nếu quên mật khẩu.
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      {/* Decorative elements */}
      <div style={{
        position: 'absolute', top: '10%', left: '10%', width: '200px', height: '200px',
        borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(40px)'
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '10%', width: '300px', height: '300px',
        borderRadius: '50%', background: 'rgba(255,255,255,0.08)', filter: 'blur(60px)'
      }} />

      <Suspense fallback={
        <div style={{ padding: '40px', background: 'white', borderRadius: '24px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
