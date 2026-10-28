import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const { full_name, password } = await request.json()
  const cleanFullName = full_name?.trim()

  if (!cleanFullName) {
    return NextResponse.json({ error: 'Họ tên không được để trống' }, { status: 400 })
  }

  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update profile full_name in public.profiles
  const { error: profError } = await adminSupabase
    .from('profiles')
    .update({ full_name: cleanFullName })
    .eq('id', user.id)

  if (profError) {
    return NextResponse.json({ error: profError.message }, { status: 500 })
  }

  // Update user in auth (password and metadata)
  const authUpdates: { password?: string; user_metadata?: Record<string, any> } = {
    user_metadata: { ...user.user_metadata, full_name: cleanFullName }
  }

  if (password && password.trim().length > 0) {
    if (password.trim().length < 6) {
      return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' }, { status: 400 })
    }
    authUpdates.password = password.trim()
  }

  const { error: authError } = await adminSupabase.auth.admin.updateUserById(user.id, authUpdates)
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, full_name: cleanFullName })
}
