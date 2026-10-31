import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { encodeDisbandInfo } from '@/lib/schedule-utils'

export async function POST(request: NextRequest) {
  try {
    // 1. Verify caller is admin
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ giáo viên quản trị mới có quyền giải tán lớp' }, { status: 403 })
    }

    // 2. Parse request
    const { class_id, reason = 'Lớp đã tốt nghiệp hoặc giải tán', action = 'archive' } = await request.json()
    if (!class_id) {
      return NextResponse.json({ error: 'Thiếu mã lớp học' }, { status: 400 })
    }

    // 3. Supabase admin client
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 4. Find all enrolled students in this class
    const { data: enrollments, error: enrollError } = await adminSupabase
      .from('students_classes')
      .select('student_id, profiles(id, full_name, username)')
      .eq('class_id', class_id)

    if (enrollError) {
      return NextResponse.json({ error: 'Lỗi truy vấn học sinh: ' + enrollError.message }, { status: 500 })
    }

    const studentIds = (enrollments || []).map(e => e.student_id).filter(Boolean)
    const lockedStudents: { id: string; name: string; username: string }[] = []

    // 5. Lock all student accounts in profiles and Supabase Auth
    if (studentIds.length > 0) {
      // Set is_active = false in profiles table
      const { error: lockProfileError } = await adminSupabase
        .from('profiles')
        .update({ is_active: false })
        .in('id', studentIds)

      if (lockProfileError) {
        console.error('Error locking student profiles:', lockProfileError)
      }

      // Ban in auth.users so tokens are immediately rejected
      for (const enrollment of enrollments || []) {
        const sid = enrollment.student_id
        const p = enrollment.profiles as any
        lockedStudents.push({
          id: sid,
          name: p?.full_name || 'Học sinh',
          username: p?.username || ''
        })

        try {
          // Ban duration 100 years
          await adminSupabase.auth.admin.updateUserById(sid, {
            ban_duration: '876000h'
          })
        } catch (err) {
          console.warn(`Could not set auth ban for user ${sid}:`, err)
        }
      }
    }

    // 6. Handle Class Record (Archive or Delete)
    if (action === 'delete') {
      // Delete the class
      const { error: delError } = await adminSupabase
        .from('classes')
        .delete()
        .eq('id', class_id)

      if (delError) {
        return NextResponse.json({ error: 'Lỗi xóa lớp: ' + delError.message }, { status: 500 })
      }
    } else {
      // Archive: Mark class as disbanded while keeping historical records
      const { data: classData } = await adminSupabase
        .from('classes')
        .select('*')
        .eq('id', class_id)
        .single()

      if (classData) {
        const prefix = '[ĐÃ GIẢI TÁN]'
        const newName = classData.name.startsWith(prefix) ? classData.name : `${prefix} ${classData.name}`
        const updatedDescription = encodeDisbandInfo(classData.description, {
          is_disbanded: true,
          disbanded_at: new Date().toISOString(),
          reason
        })

        await adminSupabase
          .from('classes')
          .update({
            name: newName,
            description: updatedDescription
          })
          .eq('id', class_id)
      }
    }

    return NextResponse.json({
      success: true,
      lockedCount: studentIds.length,
      lockedStudents,
      action
    })
  } catch (err: any) {
    console.error('Error in disband-class route:', err)
    return NextResponse.json({ error: err.message || 'Lỗi hệ thống' }, { status: 500 })
  }
}
