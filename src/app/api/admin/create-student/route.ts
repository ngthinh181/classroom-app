import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Verify the caller is admin
  const serverSupabase = await createServerClient()
  const { data: { user } } = await serverSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const { data: profile } = await serverSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username, password, full_name, class_id } = await request.json()
  if (!username || !password || !full_name) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 })
  }

  // Use service role key to create users
  const adminSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const email = `${username}@lop.local`

  // Create auth user
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role: 'student' },
  })

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'Tên đăng nhập đã tồn tại' }, { status: 409 })
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Assign to class if provided
  if (class_id && authData.user) {
    await adminSupabase.from('students_classes').insert({
      student_id: authData.user.id,
      class_id,
    })
  }

  return NextResponse.json({ user: authData.user })
}
