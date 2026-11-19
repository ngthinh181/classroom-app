import { createClient } from '@supabase/supabase-js'

export interface MCQQuestionInput {
  question_number: number
  content: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
}

export interface MCQSavedSolution {
  question_number: number
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

export interface EssayMistake {
  part: string
  why_wrong: string
  correct_solution: string
}

export interface EssayGradingResult {
  score: number // scale 0-10
  verdict: 'excellent' | 'good' | 'average' | 'needs_improvement'
  verdict_text: string
  strengths: string[]
  mistakes: EssayMistake[]
  feedback: string
}

/**
 * Get stored Gemini API key from Supabase settings or environment variables
 */
export async function getGeminiApiKey(): Promise<string> {
  // 1. Check environment variable first
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY.trim()
  }

  // 2. Check Supabase settings table
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'gemini_api_key')
      .maybeSingle()

    if (data?.value) {
      return data.value.trim()
    }
  } catch (err) {
    console.error('Failed to query gemini_api_key from settings:', err)
  }

  return ''
}

/**
 * Save Gemini API key to Supabase settings
 */
export async function saveGeminiApiKey(apiKey: string): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Check if key exists
    const { data } = await supabase
      .from('settings')
      .select('id')
      .eq('key', 'gemini_api_key')
      .maybeSingle()

    if (data?.id) {
      const { error } = await supabase
        .from('settings')
        .update({ value: apiKey.trim(), updated_at: new Date().toISOString() })
        .eq('id', data.id)
      return !error
    } else {
      const { error } = await supabase
        .from('settings')
        .insert({ key: 'gemini_api_key', value: apiKey.trim(), updated_at: new Date().toISOString() })
      return !error
    }
  } catch (err) {
    console.error('Failed to save gemini_api_key:', err)
    return false
  }
}

/**
 * Helper to call Gemini Generative Language API
 */
async function callGemini(prompt: string, apiKey: string, inlineMedia?: { mimeType: string; dataBase64: string }): Promise<string> {
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash']
  let lastError: any = null

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const parts: any[] = [{ text: prompt }]
    if (inlineMedia) {
      parts.push({
        inlineData: {
          mimeType: inlineMedia.mimeType,
          data: inlineMedia.dataBase64
        }
      })
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.1,
            topP: 0.95,
          }
        })
      })

      if (!res.ok) {
        const errorText = await res.text()
        lastError = new Error(`Gemini API error (${res.status}): ${errorText}`)
        continue
      }

      const json = await res.json()
      const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text
      if (candidateText) {
        return candidateText
      }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('Không thể kết nối đến AI Gemini')
}

/**
 * Solve Multiple Choice Questions automatically with step-by-step reasoning
 */
export async function solveMCQWithAI(
  questions: MCQQuestionInput[],
  apiKey: string
): Promise<MCQSavedSolution[]> {
  if (!questions || questions.length === 0) return []

  const formattedQuestions = questions.map(q => `
Câu ${q.question_number}: ${q.content}
A. ${q.option_a}
B. ${q.option_b}
C. ${q.option_c}
D. ${q.option_d}
`).join('\n---\n')

  const prompt = `
Bạn là một giáo viên chuyên môn xuất sắc. Nhiệm vụ của bạn là giải và tìm ra đáp án chính xác cho từng câu hỏi trắc nghiệm dưới đây.
Với mỗi câu hỏi:
1. Đọc kỹ câu hỏi và 4 phương án A, B, C, D.
2. Suy luận logic hoặc tính toán chính xác để chọn ra phương án đúng nhất (CHỈ chọn 1 trong 4 chữ cái: A, B, C, hoặc D).
3. Viết lời giải thích ngắn gọn, rõ ràng (1-2 câu) vì sao đáp án đó đúng.

Dưới đây là danh sách câu hỏi:
${formattedQuestions}

QUAN TRỌNG: Bạn BẮT BUỘC phải trả về kết quả dưới dạng JSON thuần túy (không chứa markdown backticks ngoài json), theo đúng cấu trúc sau:
[
  {
    "question_number": 1,
    "correct_answer": "A",
    "explanation": "Giải thích ngắn gọn vì sao A đúng..."
  }
]
`

  const responseText = await callGemini(prompt, apiKey)
  
  // Extract JSON from response
  let cleaned = responseText.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }

  const jsonStart = cleaned.indexOf('[')
  const jsonEnd = cleaned.lastIndexOf(']')
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
  }

  const parsed = JSON.parse(cleaned) as MCQSavedSolution[]
  return parsed.map(item => ({
    question_number: Number(item.question_number),
    correct_answer: (['A', 'B', 'C', 'D'].includes(item.correct_answer?.toUpperCase()) ? item.correct_answer.toUpperCase() : 'A') as 'A' | 'B' | 'C' | 'D',
    explanation: item.explanation || 'Đáp án chính xác theo kiến thức chuẩn.'
  }))
}

/**
 * Grade an essay/assignment submission with AI reasoning, finding mistakes and explaining why
 */
export async function gradeEssayWithAI(
  assignment: { title: string; description?: string | null; file_text?: string },
  studentSubmission: { text_content?: string; student_note?: string; file_name?: string },
  apiKey: string,
  mediaData?: { mimeType: string; dataBase64: string }
): Promise<EssayGradingResult> {
  const prompt = `
Bạn là một giáo viên tận tâm, công tâm và giàu kinh nghiệm sư phạm.
Nhiệm vụ của bạn là đọc đề bài và chấm bài làm của học sinh dưới đây, đưa ra suy luận xem bài đó làm có đúng hay không, nếu sai thì đánh dấu cụ thể chỗ sai và giải thích cặn kẽ vì sao sai.

=== ĐỀ BÀI ===
Tiêu đề: ${assignment.title}
Yêu cầu / Mô tả: ${assignment.description || 'Không có mô tả thêm'}
${assignment.file_text ? `Nội dung file đề bài:\n${assignment.file_text.substring(0, 3000)}` : ''}

=== BÀI LÀM CỦA HỌC SINH ===
Tên file nộp: ${studentSubmission.file_name || 'Bài làm trực tiếp'}
${studentSubmission.student_note ? `Ghi chú của học sinh: ${studentSubmission.student_note}\n` : ''}
${studentSubmission.text_content ? `Nội dung bài làm:\n${studentSubmission.text_content.substring(0, 5000)}` : '(Xem nội dung bài làm từ file ảnh/tài liệu đính kèm)'}

=== HƯỚNG DẪN CHẤM BÀI & SUY LUẬN ===
1. Phân tích xem học sinh đã giải quyết đúng yêu cầu đề bài chưa.
2. Liệt kê các điểm học sinh làm đúng, làm tốt (strengths).
3. ĐẶC BIỆT QUAN TRỌNG - NẾU CÓ CHỖ SAI:
   - Chỉ rõ cụ thể câu nào, bước nào hoặc ý nào bị sai (part).
   - GIẢI THÍCH VÌ SAO SAI (why_wrong): Chỉ rõ nguyên nhân (nhầm lẫn công thức, tính sai số, hiểu sai khái niệm, diễn đạt sai...).
   - HƯỚNG DẪN CÁCH LÀM ĐÚNG (correct_solution): Đưa ra cách giải hoặc câu trả lời chuẩn.
   (Nếu bài làm hoàn hảo không có lỗi sai, danh sách mistakes có thể để trống).
4. Chấm điểm đề xuất trên thang điểm 10 (từ 0.0 đến 10.0, có thể lấy số thập phân như 8.5, 9.0).
5. Viết một lời nhận xét tổng quan mang tính sư phạm, khích lệ và chỉ dẫn học sinh tiến bộ.

QUAN TRỌNG: Trả về kết quả hoàn toàn bằng tiếng Việt dưới định dạng JSON chuẩn:
{
  "score": 8.5,
  "verdict": "good",
  "verdict_text": "Làm bài tốt, nắm chắc kiến thức cơ bản",
  "strengths": [
    "Trình bày rõ ràng, đúng trọng tâm đề bài",
    "Áp dụng chính xác công thức..."
  ],
  "mistakes": [
    {
      "part": "Câu 2 / Bước 3",
      "why_wrong": "Học sinh tính nhầm 4 x 7 = 24 thay vì 28, dẫn đến kết quả cuối cùng bị sai.",
      "correct_solution": "Phép tính đúng phải là: 4 x 7 = 28, sau đó cộng thêm 5 để ra kết quả 33."
    }
  ],
  "feedback": "Bài làm tương đối tốt, chữ viết rõ ràng. Cần chú ý cẩn thận hơn ở các phép tính cơ bản để tránh mất điểm đáng tiếc."
}
`

  const responseText = await callGemini(prompt, apiKey, mediaData)

  let cleaned = responseText.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }

  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  if (jsonStart !== -1 && jsonEnd !== -1) {
    cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
  }

  const parsed = JSON.parse(cleaned)

  return {
    score: typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 7.0,
    verdict: parsed.verdict || 'good',
    verdict_text: parsed.verdict_text || 'Đã hoàn thành bài làm',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
    feedback: parsed.feedback || 'Bài làm đã được chấm điểm.'
  }
}

/**
 * Format grading result into rich pedagogical feedback string
 */
export function formatAIFeedbackString(result: EssayGradingResult, teacherNote?: string): string {
  let lines: string[] = []

  lines.push(`🎯 ĐIỂM ĐÁNH GIÁ: ${result.score}/10 (${result.verdict_text})`)
  lines.push('')

  if (result.strengths && result.strengths.length > 0) {
    lines.push('✅ ƯU ĐIỂM & PHẦN LÀM ĐÚNG:')
    result.strengths.forEach(s => lines.push(`• ${s}`))
    lines.push('')
  }

  if (result.mistakes && result.mistakes.length > 0) {
    lines.push('⚠️ CÁC LỖI SAI & GIẢI THÍCH VÌ SAO SAI:')
    result.mistakes.forEach((m, idx) => {
      lines.push(`${idx + 1}. [${m.part}]`)
      lines.push(`   ❌ Vì sao sai: ${m.why_wrong}`)
      lines.push(`   💡 Cách sửa đúng: ${m.correct_solution}`)
    })
    lines.push('')
  } else {
    lines.push('🎉 Bài làm không có lỗi sai đáng kể!')
    lines.push('')
  }

  lines.push('📝 NHẬN XÉT CỦA GIÁO VIÊN:')
  lines.push(teacherNote?.trim() || result.feedback)

  return lines.join('\n')
}
