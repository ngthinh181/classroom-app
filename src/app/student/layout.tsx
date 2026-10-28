'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard, Calendar, ClipboardCheck,
  FileText, LogOut, Menu, X, BookOpen, ChevronRight, GraduationCap
} from 'lucide-react'

const menuItems = [
  { href: '/student', label: 'Trang chủ', icon: LayoutDashboard },
  { href: '/student/schedule', label: 'Lịch học', icon: Calendar },
  { href: '/student/attendance', label: 'Chuyên cần', icon: ClipboardCheck },
  { href: '/student/assignments', label: 'Bài tập', icon: FileText },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [className, setClassName] = useState<string>('')
  const { user, profile } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const studentName = profile?.full_name || ''
  const username = profile?.username || ''

  // Only fetch class name (lightweight query)
  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from('students_classes')
      .select('classes(name)')
      .eq('student_id', user.id)
      .limit(1)
      .then(({ data }: { data: any }) => {
        const name = (data?.[0]?.classes as unknown as { name?: string })?.name
        if (name) setClassName(name)
      })
  }, [user])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/student') return pathname === '/student'
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 40, display: 'block'
          }}
          className="md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
        style={{
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
          }}>
            <GraduationCap size={24} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '16px', color: 'white' }}>Cổng Học Sinh</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Học tập & Rèn luyện</div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden"
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'white', cursor: 'pointer', padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              <span style={{ fontWeight: '500' }}>{item.label}</span>
              {isActive(item.href) && (
                <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.7 }} />
              )}
            </Link>
          ))}
        </nav>

        {/* Student info box */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <div
              suppressHydrationWarning
              style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '15px', fontWeight: '700', color: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              {studentName?.[0]?.toUpperCase() || 'H'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                suppressHydrationWarning
                style={{
                  fontSize: '13px', fontWeight: '600', color: 'white',
                  whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'
                }}
              >
                {studentName || 'Học sinh'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                {className ? `Lớp: ${className}` : `@${username || 'hocsinh'}`}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-link"
            style={{ width: '100%', margin: 0, padding: '10px 12px', color: '#f87171' }}
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: '260px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }} className="main-content">
        {/* Top bar for mobile */}
        <div
          className="md:hidden"
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
            padding: '12px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', borderBottom: '1px solid var(--border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <Menu size={24} color="#1e293b" />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px',
                background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <GraduationCap size={16} color="white" />
              </div>
              <span style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>Cổng Học Sinh</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>
              {studentName.split(' ').slice(-1)[0] || 'Học sinh'}
            </span>
          </div>
        </div>

        <div style={{ padding: '24px', flex: 1 }} className="animate-fade-in max-w-6xl mx-auto w-full">
          {children}
        </div>
      </main>

      <style jsx>{`
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0 !important;
          }
        }
        @media (min-width: 769px) {
          .md\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
