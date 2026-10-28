'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import {
  LayoutDashboard, Users, Calendar, ClipboardCheck,
  FileText, BarChart3, LogOut, Menu, X, BookOpen, ChevronRight, UserCog
} from 'lucide-react'

const menuItems = [
  { href: '/admin', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/admin/classes', label: 'Lớp & Học sinh', icon: Users },
  { href: '/admin/schedule', label: 'Lịch học', icon: Calendar },
  { href: '/admin/attendance', label: 'Điểm danh', icon: ClipboardCheck },
  { href: '/admin/assignments', label: 'Bài tập', icon: FileText },
  { href: '/admin/stats', label: 'Thống kê', icon: BarChart3 },
  { href: '/admin/settings', label: 'Tài khoản & Giáo viên', icon: UserCog },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { profile } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const userName = profile?.full_name || 'Admin'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
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
        }}
      >
        {/* Logo */}
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <BookOpen size={22} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '16px' }}>Quản lý lớp học</div>
            <div style={{ fontSize: '11px', opacity: 0.6 }}>Dành cho giáo viên</div>
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
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {isActive(item.href) && (
                <ChevronRight size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              )}
            </Link>
          ))}
        </nav>

        {/* User info */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              suppressHydrationWarning
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #f472b6, #fb923c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: '700'
              }}
            >
              {userName?.[0]?.toUpperCase() || 'A'}
            </div>
            <div>
              <div suppressHydrationWarning style={{ fontSize: '13px', fontWeight: '600' }}>{userName}</div>
              <div style={{ fontSize: '11px', opacity: 0.6 }}>Quản trị viên</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="sidebar-link"
            style={{ width: '100%', margin: 0, padding: '10px 12px' }}
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: '260px', minHeight: '100vh' }} className="main-content">
        {/* Top bar for mobile */}
        <div
          className="md:hidden"
          style={{
            position: 'sticky', top: 0, zIndex: 30,
            background: 'rgba(248,250,252,0.9)', backdropFilter: 'blur(10px)',
            padding: '12px 16px', display: 'flex', alignItems: 'center',
            gap: '12px', borderBottom: '1px solid var(--border)'
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            <Menu size={24} color="#1e293b" />
          </button>
          <span style={{ fontWeight: '600', fontSize: '16px' }}>Quản lý lớp học</span>
        </div>

        <div style={{ padding: '24px' }} className="animate-fade-in">
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
