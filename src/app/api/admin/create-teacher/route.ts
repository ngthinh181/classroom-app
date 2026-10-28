import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Verify the caller is an admin
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  
  const { data: profile } = await serverSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Không có quyền quản trị' }, { status: 403 })

  const { username, password, full_name } = await request.json()
  const cleanUsername = username?.trim().toLowerCase()
  const cleanFullName = full_name?.trim()

  if (!cleanUsername || !password || !cleanFullName) {
    return NextResponse.json({ error: 'Vui lòng điền đầy đủ họ tên, tên đăng nhập và mật khẩu' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' }, { status: 400 })
  }

  // Use service role key to manage users
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const email = `${cleanUsername}@lop.local`

  // Create auth user with role 'admin'
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: cleanFullName, role: 'admin' },
  })

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'Tên đăng nhập này đã có người sử dụng' }, { status: 409 })
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Ensure profile has role admin
  if (authData.user) {
    await adminSupabase.from('profiles').upsert({
      id: authData.user.id,
      username: cleanUsername,
      full_name: cleanFullName,
      role: 'admin',
      is_active: true,
    })
  }

  return NextResponse.json({ success: true, user: authData.user })
}
