import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  getGeminiApiKey, saveGeminiApiKey, solveMCQWithAI,
  gradeEssayWithAI, formatAIFeedbackString
} from '@/lib/gemini-ai'
import mammoth from 'mammoth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller is admin
    const serverSupabase = await createServerClient()
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const { data: profile } = await serverSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Chỉ giáo viên quản trị mới có quyền sử dụng tính năng này' }, { status: 403 })
    }

    const body = await req.json()
    const { action } = body

    // 2. Action: Get API Key Status
    if (action === 'get_api_key_status') {
      const key = await getGeminiApiKey()
      const hasKey = Boolean(key && key.length > 5)
      const maskedKey = hasKey
        ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}`
        : ''
      return NextResponse.json({ hasKey, maskedKey })
    }

    // 3. Action: Save API Key
    if (action === 'save_api_key') {
      const { apiKey } = body
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 5) {
        return NextResponse.json({ error: 'Khóa API không hợp lệ' }, { status: 400 })
      }
      const ok = await saveGeminiApiKey(apiKey.trim())
      if (!ok) {
        return NextResponse.json({ error: 'Không thể lưu khóa API vào CSDL' }, { status: 500 })
      }
      return NextResponse.json({ success: true, message: 'Đã lưu Gemini API Key thành công' })
    }

    // Helper to resolve API Key
    let resolvedApiKey = body.apiKey?.trim() || ''
    if (!resolvedApiKey) {
      resolvedApiKey = await getGeminiApiKey()
    }

    if (!resolvedApiKey) {
      return NextResponse.json({
        error: 'Chưa cấu hình Google Gemini API Key',
        need_api_key: true,
        message: 'Vui lòng nhập Google Gemini API Key (hoàn toàn miễn phí) để sử dụng tính năng AI giải đề và chấm bài tự luận.'
      }, { status: 400 })
    }

    // 4. Action: Solve MCQ (Tự tìm hiểu và giải trắc nghiệm không cần đáp án)
    if (action === 'solve_mcq') {
      const { questions } = body
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return NextResponse.json({ error: 'Danh sách câu hỏi trống' }, { status: 400 })
      }

      const solutions = await solveMCQWithAI(questions, resolvedApiKey)
      return NextResponse.json({
        success: true,
        count: solutions.length,
        solutions
      })
    }

    // 5. Action: Grade Essay / Hybrid Exam (Chấm bài tự luận hoặc gộp Trắc nghiệm + Tự luận)
    if (action === 'grade_essay') {
      const { assignment, submission, quiz_info } = body
      if (!assignment || !submission) {
        return NextResponse.json({ error: 'Thiếu thông tin đề bài hoặc bài nộp của học sinh' }, { status: 400 })
      }

      let extractedStudentText = submission.text_content || ''
      let mediaData: { mimeType: string; dataBase64: string } | undefined = undefined

      // If submission has a file_url, try to extract its text or load image
      if (submission.file_url) {
        try {
          const fileRes = await fetch(submission.file_url)
          if (fileRes.ok) {
            const arrayBuffer = await fileRes.arrayBuffer()
            const fileName = (submission.file_name || submission.file_url).toLowerCase()

            if (fileName.endsWith('.docx')) {
              const result = await mammoth.extractRawText({ arrayBuffer })
              extractedStudentText += `\n[Nội dung file Word ${submission.file_name || ''}]:\n${result.value}`
            } else if (fileName.endsWith('.pdf')) {
              const { PDFParse } = await import('pdf-parse')
              const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) })
              const textResult = await parser.getText()
              extractedStudentText += `\n[Nội dung file PDF ${submission.file_name || ''}]:\n${textResult.text || ''}`
              await parser.destroy()
            } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
              const text = Buffer.from(arrayBuffer).toString('utf-8')
              extractedStudentText += `\n[Nội dung file text]:\n${text}`
            } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.webp')) {
              const mime = fileName.endsWith('.png') ? 'image/png' : fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
              mediaData = {
                mimeType: mime,
                dataBase64: Buffer.from(arrayBuffer).toString('base64')
              }
            }
          }
        } catch (fetchErr) {
          console.warn('Could not extract file text from submission url:', fetchErr)
        }
      }

      const gradingResult = await gradeEssayWithAI(
        {
          title: assignment.title,
          description: assignment.description,
          file_text: assignment.file_text
        },
        {
          text_content: extractedStudentText.trim(),
          student_note: submission.student_note,
          file_name: submission.file_name
        },
        resolvedApiKey,
        mediaData,
        quiz_info
      )

      const formattedFeedback = formatAIFeedbackString(gradingResult)

      return NextResponse.json({
        success: true,
        gradingResult,
        formattedFeedback
      })
    }

    return NextResponse.json({ error: 'Hành động không hợp lệ' }, { status: 400 })
  } catch (err: any) {
    console.error('Error in ai-grade route:', err)
    return NextResponse.json({
      error: err.message || 'Lỗi xử lý AI',
      details: String(err)
    }, { status: 500 })
  }
}
