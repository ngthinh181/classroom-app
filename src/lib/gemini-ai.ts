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

export interface QuizGradingInfo {
  quiz_score?: number | null
  total_quiz_questions?: number
  quiz_max_score?: number
}

export interface EssayGradingResult {
  score: number // score for essay or total combined
  essay_score?: number // explicit score for essay part
  quiz_score?: number // quiz score if hybrid
  total_score?: number // total combined score
  is_hybrid?: boolean
  verdict: 'excellent' | 'good' | 'average' | 'needs_improvement'
  verdict_text: string
  strengths: string[]
  mistakes: EssayMistake[]
  feedback: string
}

/**
 * Grade an essay/assignment submission with AI reasoning, finding mistakes and explaining why.
 * Also seamlessly supports hybrid assignments (combining MCQs and Essay).
 */
export async function gradeEssayWithAI(
  assignment: { title: string; description?: string | null; file_text?: string },
  studentSubmission: { text_content?: string; student_note?: string; file_name?: string },
  apiKey: string,
  mediaData?: { mimeType: string; dataBase64: string },
  quizInfo?: QuizGradingInfo
): Promise<EssayGradingResult> {
  const isHybrid = Boolean(quizInfo && quizInfo.quiz_score !== null && quizInfo.quiz_score !== undefined)
  const quizScoreVal = isHybrid ? Number(quizInfo?.quiz_score || 0) : 0
  const quizMaxScoreVal = quizInfo?.quiz_max_score || (quizInfo?.total_quiz_questions ? quizInfo.total_quiz_questions : 5)
  const essayTargetMax = isHybrid ? Math.max(1, 10 - quizMaxScoreVal) : 10

  const prompt = `
Bạn là một giáo viên tận tâm, công tâm và giàu kinh nghiệm sư phạm.
Nhiệm vụ của bạn là đọc đề bài và chấm bài làm của học sinh dưới đây, đưa ra suy luận xem bài đó làm có đúng hay không, nếu sai thì đánh dấu cụ thể chỗ sai và giải thích cặn kẽ vì sao sai.

=== ĐỀ BÀI ===
Tiêu đề: ${assignment.title}
Yêu cầu / Mô tả: ${assignment.description || 'Không có mô tả thêm'}
${assignment.file_text ? `Nội dung file đề bài:\n${assignment.file_text.substring(0, 3000)}` : ''}

${isHybrid ? `=== PHẦN TRẮC NGHIỆM ĐÃ LÀM (GỘP BÀI THI) ===
- Học sinh đã hoàn thành phần Trắc nghiệm và đạt: ${quizScoreVal} điểm (trên thang điểm ${quizMaxScoreVal} điểm trắc nghiệm)${quizInfo?.total_quiz_questions ? `, tổng số ${quizInfo.total_quiz_questions} câu trắc nghiệm` : ''}.
` : ''}

=== BÀI LÀM TỰ LUẬN CỦA HỌC SINH ===
Tên file nộp: ${studentSubmission.file_name || 'Bài làm trực tiếp'}
${studentSubmission.student_note ? `Ghi chú của học sinh: ${studentSubmission.student_note}\n` : ''}
${studentSubmission.text_content ? `Nội dung bài làm:\n${studentSubmission.text_content.substring(0, 5000)}` : '(Xem nội dung bài làm từ file ảnh/tài liệu đính kèm)'}

=== HƯỚNG DẪN CHẤM BÀI & SUY LUẬN ===
1. Phân tích xem học sinh đã giải quyết đúng yêu cầu đề bài tự luận chưa.
2. Liệt kê các điểm học sinh làm đúng, làm tốt (strengths).
3. ĐẶC BIỆT QUAN TRỌNG - NẾU CÓ CHỖ SAI Ở PHẦN TỰ LUẬN:
   - Chỉ rõ cụ thể câu nào, bước nào hoặc ý nào bị sai (part).
   - GIẢI THÍCH VÌ SAO SAI (why_wrong): Chỉ rõ nguyên nhân (nhầm lẫn công thức, tính sai số, hiểu sai khái niệm, diễn đạt sai...).
   - HƯỚNG DẪN CÁCH LÀM ĐÚNG (correct_solution): Đưa ra cách giải hoặc câu trả lời chuẩn.
   (Nếu bài làm hoàn hảo không có lỗi sai, danh sách mistakes có thể để trống).
4. CHẤM ĐIỂM:
   ${isHybrid ? `- Chấm điểm phần TỰ LUẬN (essay_score) trên thang điểm tối đa ${essayTargetMax} điểm (hoặc thang 10 rồi quy đổi).
   - TÍNH TỔNG ĐIỂM GỘP (total_score): Điểm trắc nghiệm (${quizScoreVal}) + Điểm tự luận (essay_score), thang điểm 10 tròn (từ 0.0 đến 10.0).` : `- Chấm điểm đề xuất trên thang điểm 10 (từ 0.0 đến 10.0, có thể lấy số thập phân như 8.5, 9.0).`}
5. Viết một lời nhận xét tổng quan mang tính sư phạm, khích lệ và chỉ dẫn học sinh tiến bộ ${isHybrid ? '(nhận xét bao gồm cả phong độ trắc nghiệm và phần tự luận)' : ''}.

QUAN TRỌNG: Trả về kết quả hoàn toàn bằng tiếng Việt dưới định dạng JSON chuẩn:
{
  "score": ${isHybrid ? '8.5' : '8.5'},
  "essay_score": ${isHybrid ? '3.5' : '8.5'},
  "quiz_score": ${isHybrid ? `${quizScoreVal}` : 'null'},
  "total_score": ${isHybrid ? '8.5' : '8.5'},
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

  const essayScore = typeof parsed.essay_score === 'number'
    ? parsed.essay_score
    : (typeof parsed.score === 'number' ? parsed.score : 7.0)

  let totalScore = typeof parsed.total_score === 'number' ? parsed.total_score : essayScore
  if (isHybrid) {
    totalScore = Math.min(10, Math.round((quizScoreVal + essayScore) * 10) / 10)
  }

  return {
    score: isHybrid ? essayScore : totalScore,
    essay_score: essayScore,
    quiz_score: isHybrid ? quizScoreVal : undefined,
    total_score: totalScore,
    is_hybrid: isHybrid,
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

  if (result.is_hybrid && result.quiz_score !== undefined) {
    lines.push(`📊 TỔNG HỢP KẾT QUẢ BÀI LÀM (GỘP TRẮC NGHIỆM & TỰ LUẬN):`)
    lines.push(`• 🎯 Điểm Trắc nghiệm: ${result.quiz_score}đ`)
    lines.push(`• 📝 Điểm Tự luận: ${result.essay_score ?? result.score}đ`)
    lines.push(`➔ 🏆 TỔNG ĐIỂM: ${result.total_score ?? result.score}/10 (${result.verdict_text})`)
    lines.push('')
  } else {
    lines.push(`🎯 ĐIỂM ĐÁNH GIÁ: ${result.score}/10 (${result.verdict_text})`)
    lines.push('')
  }

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

export interface AIParsedQuestion {
  question_number: number
  content: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation?: string
  points: number
  has_answer: boolean
}

export interface AIParsedExamResult {
  exam_type: 'trac_nghiem' | 'tu_luan' | 'hybrid'
  questions: AIParsedQuestion[]
  essay_content?: string
  has_essay: boolean
  has_quiz: boolean
  is_hybrid: boolean
  suggested_quiz_points: number
  suggested_essay_points: number
  answers_found_count: number
  missing_answers_count: number
}

/**
 * Intelligent AI Exam Scanner that understands true structure of the document:
 * - Distinguishes between Multiple Choice and Math Exercises/Essay.
 * - Restores corrupted OCR/math symbols (e.g. cấp số nhân u_1, u_n, q, formulas).
 * - Extracts real options without ever fabricating fake ones like "Đáp án B/C/D".
 * - Automatically solves questions if no answer key exists.
 */
export async function parseExamWithAI(
  input: {
    text_content?: string
    file_name?: string
    manual_answer_key?: string
    media_data?: { mimeType: string; dataBase64: string }
  },
  apiKey: string
): Promise<AIParsedExamResult> {
  const prompt = `
Bạn là một trợ lý AI giáo dục cao cấp chuyên phân tích, hiểu sâu và số hóa đề thi (Toán học, Vật lý, Hóa học, Ngữ văn, Tiếng Anh,...).
Nhiệm vụ của bạn là đọc và hiểu toàn bộ nội dung đề thi được cung cấp (từ văn bản hoặc file tài liệu đính kèm), sau đó phân loại và trích xuất thành cấu trúc đề thi chuẩn xác 100% theo đúng ý đồ của giáo viên ra đề.

${input.file_name ? `Tên file tài liệu: ${input.file_name}` : ''}
${input.manual_answer_key ? `Bảng đáp án giáo viên cung cấp thêm: ${input.manual_answer_key}` : ''}

=== NỘI DUNG VĂN BẢN TRÍCH XUẤT TỪ FILE ===
${input.text_content ? input.text_content.substring(0, 20000) : '(Xem tài liệu đính kèm)'}

=== QUY TẮC PHÂN LOẠI & TRÍCH XUẤT CỰC KỲ QUAN TRỌNG ===

1. PHÂN BIỆT BẢN CHẤT BÀI TẬP:
- TRẮC NGHIỆM: CHỈ những câu hỏi thực sự có các phương án lựa chọn A, B, C, D (hoặc A, B, C).
  * Giữ nguyên vẹn nội dung câu hỏi và các phương án A, B, C, D như trong đề gốc.
  * Nếu các ký hiệu toán học bị lỗi font khi trích xuất (ví dụ: 'k k uu q - =', 'u1', 'q', 'S_n'), hãy dựa vào ngữ cảnh (cấp số cộng, cấp số nhân, hàm số, đạo hàm...) để khôi phục lại công thức toán học chuẩn đẹp (ví dụ: u_1, u_5, q).
  * TUYỆT ĐỐI KHÔNG tự bịa ra các phương án giả như 'Đáp án B', 'Đáp án C', 'Đáp án D' nếu đề không có!
  * Đáp án đúng:
    - Nếu đề bài hoặc bảng đáp án có sẵn đáp án (khoanh tròn, in đậm, gạch chân, hoặc bảng đáp án ở cuối), hãy lấy đúng đáp án đó.
    - Nếu đề KHÔNG có đáp án: BẠN HÃY TỰ GIẢI CÂU HỎI ĐÓ CHÍNH XÁC, chọn đáp án đúng nhất (A, B, C hoặc D) và viết lời giải thích ngắn gọn (1-2 câu) vào 'explanation'.
- TỰ LUẬN / BÀI TẬP (Math Exercises / Essay):
  * Bất kỳ bài toán nào KHÔNG có 4 phương án trắc nghiệm A, B, C, D (ví dụ: 'Bài tập 1: Tìm số hạng đầu và công bội của cấp số nhân, biết:...', 'Bài 2: Giải phương trình...', 'Câu hỏi tự luận...').
  * Kể cả khi bài toán có các câu hỏi nhỏ dạng ý a), b), c) để học sinh giải, ĐÂY VẪN LÀ BÀI TẬP TỰ LUẬN!
  * TUYỆT ĐỐI KHÔNG biến bài tự luận thành câu trắc nghiệm!
  * Hãy đưa toàn bộ các bài tự luận này vào trường 'essay_content', trình bày sạch sẽ, phân định rõ 'Bài 1: ...', 'Bài 2: ...', khôi phục các công thức toán chuẩn đẹp.

2. CÁC LOẠI ĐỀ THI:
- Đề toàn trắc nghiệm (trac_nghiem): Có nhiều câu trắc nghiệm, không có phần tự luận.
- Đề toàn tự luận (tu_luan): Chỉ có các bài tập/câu hỏi tự luận (như file bài tập toán cấp số nhân). Khi đó: 'questions' là mảng rỗng [], 'has_quiz': false, 'has_essay': true, 'essay_content' chứa toàn bộ bài tập, 'suggested_quiz_points': 0, 'suggested_essay_points': 10.
- Đề hỗn hợp (hybrid): Có cả phần trắc nghiệm và phần tự luận.

3. ĐỊNH DẠNG TRẢ VỀ:
BẮT BUỘC trả về đúng cú pháp JSON thuần túy (không kèm markdown ngoài json):
{
  "exam_type": "trac_nghiem" | "tu_luan" | "hybrid",
  "has_quiz": boolean,
  "has_essay": boolean,
  "is_hybrid": boolean,
  "suggested_quiz_points": number,
  "suggested_essay_points": number,
  "questions": [
    {
      "question_number": 1,
      "content": "Nội dung câu hỏi...",
      "option_a": "Phương án A...",
      "option_b": "Phương án B...",
      "option_c": "Phương án C...",
      "option_d": "Phương án D...",
      "correct_answer": "A",
      "explanation": "Lời giải thích ngắn gọn...",
      "points": 1
    }
  ],
  "essay_content": "Bài tập 1: ...\\n\\nBài tập 2: ..."
}
`

  const responseText = await callGemini(prompt, apiKey, input.media_data)

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

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : []
  const hasQuiz = rawQuestions.length > 0 && parsed.exam_type !== 'tu_luan'
  const essayContent = typeof parsed.essay_content === 'string' ? parsed.essay_content.trim() : ''
  const hasEssay = Boolean(essayContent && essayContent.length > 10)
  const isHybrid = hasQuiz && hasEssay

  let suggestedQuizPoints = typeof parsed.suggested_quiz_points === 'number' ? parsed.suggested_quiz_points : (hasQuiz ? (isHybrid ? 7 : 10) : 0)
  let suggestedEssayPoints = typeof parsed.suggested_essay_points === 'number' ? parsed.suggested_essay_points : (hasEssay ? (isHybrid ? 3 : 10) : 0)

  if (!hasQuiz) {
    suggestedQuizPoints = 0
    suggestedEssayPoints = 10
  } else if (!hasEssay) {
    suggestedQuizPoints = 10
    suggestedEssayPoints = 0
  }

  const pointsPerQuestion = hasQuiz && rawQuestions.length > 0
    ? Math.round((suggestedQuizPoints / rawQuestions.length) * 100) / 100
    : 1

  const questions: AIParsedQuestion[] = rawQuestions.map((q: any, idx: number) => {
    const qNum = typeof q.question_number === 'number' ? q.question_number : (idx + 1)
    const validAns = ['A', 'B', 'C', 'D'].includes(q.correct_answer?.toUpperCase())
      ? q.correct_answer.toUpperCase() as 'A' | 'B' | 'C' | 'D'
      : 'A'
    
    return {
      question_number: qNum,
      content: String(q.content || `Câu hỏi ${qNum}`).trim(),
      option_a: String(q.option_a || '').trim(),
      option_b: String(q.option_b || '').trim(),
      option_c: String(q.option_c || '').trim(),
      option_d: String(q.option_d || '').trim(),
      correct_answer: validAns,
      explanation: q.explanation ? String(q.explanation).trim() : undefined,
      points: pointsPerQuestion,
      has_answer: Boolean(q.correct_answer)
    }
  })

  let examType: 'trac_nghiem' | 'tu_luan' | 'hybrid' = 'trac_nghiem'
  if (isHybrid) examType = 'hybrid'
  else if (!hasQuiz && hasEssay) examType = 'tu_luan'

  return {
    exam_type: examType,
    questions,
    essay_content: hasEssay ? essayContent : undefined,
    has_essay: hasEssay,
    has_quiz: hasQuiz,
    is_hybrid: isHybrid,
    suggested_quiz_points: suggestedQuizPoints,
    suggested_essay_points: suggestedEssayPoints,
    answers_found_count: questions.filter(q => q.has_answer).length,
    missing_answers_count: questions.filter(q => !q.has_answer).length
  }
}

