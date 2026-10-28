import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  
  const { data: profile } = await serverSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Không có quyền quản trị' }, { status: 403 })

  const { target_id } = await request.json()
  if (!target_id) {
    return NextResponse.json({ error: 'Thiếu ID giáo viên cần xóa' }, { status: 400 })
  }

  // Prevent admin from deleting themselves
  if (target_id === user.id) {
    return NextResponse.json({ error: 'Bạn không thể tự xóa tài khoản của chính mình' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Delete from Auth (profiles will cascade delete)
  const { error } = await adminSupabase.auth.admin.deleteUser(target_id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
