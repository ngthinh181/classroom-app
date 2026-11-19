import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { parseQuizFromText, parseAnswerKeyString } from '@/lib/quiz-parser'
import { extractTextFromPDF } from '@/lib/pdf-extractor'
import { getGeminiApiKey, parseExamWithAI } from '@/lib/gemini-ai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const answerKeyFile = formData.get('answerKeyFile') as File | null
    const manualAnswerKey = formData.get('manualAnswerKey') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Không tìm thấy file tải lên' }, { status: 400 })
    }

    const fileName = file.name.toLowerCase()
    let extractedText = ''
    let mediaData: { mimeType: string; dataBase64: string } | undefined

    // 1. Parse File Content based on extension
    if (fileName.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      extractedText = result.value
    } else if (fileName.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer()
      extractedText = await extractTextFromPDF(arrayBuffer)
      
      // If PDF file is under 15MB, also prepare mediaData for Gemini multimodal inspection
      if (file.size <= 15 * 1024 * 1024) {
        mediaData = {
          mimeType: 'application/pdf',
          dataBase64: Buffer.from(arrayBuffer).toString('base64'),
        }
      }
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      extractedText = await file.text()
    } else if (fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      const arrayBuffer = await file.arrayBuffer()
      const mime = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg'
      mediaData = {
        mimeType: mime,
        dataBase64: Buffer.from(arrayBuffer).toString('base64'),
      }
    } else {
      return NextResponse.json(
        { error: 'Định dạng file không hỗ trợ. Vui lòng tải file .pdf, .docx, .txt, hoặc ảnh .png/.jpg' },
        { status: 400 }
      )
    }

    // 2. Parse external answer key if provided
    let answerKeyMap: Record<number, 'A' | 'B' | 'C' | 'D'> = {}

    if (manualAnswerKey) {
      answerKeyMap = { ...answerKeyMap, ...parseAnswerKeyString(manualAnswerKey) }
    }

    if (answerKeyFile) {
      const akName = answerKeyFile.name.toLowerCase()
      let akText = ''
      if (akName.endsWith('.docx')) {
        const akBuf = await answerKeyFile.arrayBuffer()
        const akRes = await mammoth.extractRawText({ arrayBuffer: akBuf })
        akText = akRes.value
      } else if (akName.endsWith('.pdf')) {
        const akBuf = await answerKeyFile.arrayBuffer()
        akText = await extractTextFromPDF(akBuf)
      } else {
        akText = await answerKeyFile.text()
      }
      answerKeyMap = { ...answerKeyMap, ...parseAnswerKeyString(akText) }
    }

    // 3. Intelligently scan questions and answers with Gemini AI if available
    const apiKey = await getGeminiApiKey()

    if (apiKey) {
      try {
        const answerKeyString = Object.keys(answerKeyMap).length > 0
          ? Object.entries(answerKeyMap).map(([q, a]) => `Câu ${q}: ${a}`).join(', ')
          : (manualAnswerKey || undefined)

        const aiResult = await parseExamWithAI(
          {
            text_content: extractedText,
            file_name: file.name,
            manual_answer_key: answerKeyString,
            media_data: mediaData,
          },
          apiKey
        )

        return NextResponse.json({
          success: true,
          fileName: file.name,
          questions: aiResult.questions,
          essayContent: aiResult.essay_content,
          hasEssay: aiResult.has_essay,
          hasQuiz: aiResult.has_quiz,
          isHybrid: aiResult.is_hybrid,
          suggestedQuizPoints: aiResult.suggested_quiz_points,
          suggestedEssayPoints: aiResult.suggested_essay_points,
          answersFoundCount: aiResult.answers_found_count,
          missingAnswersCount: aiResult.missing_answers_count,
          examType: aiResult.exam_type,
          isAIParsed: true,
        })
      } catch (aiErr: any) {
        console.warn('AI exam parsing failed, falling back to local heuristic parser:', aiErr?.message || aiErr)
      }
    }

    // 4. Fallback: Local heuristic parser if no API key or AI call fails
    const parsed = parseQuizFromText(extractedText, answerKeyMap)

    return NextResponse.json({
      success: true,
      fileName: file.name,
      ...parsed,
      isAIParsed: false,
    })
  } catch (err: any) {
    console.error('Quiz scan API error:', err)
    return NextResponse.json(
      { error: 'Không thể phân tích file: ' + (err.message || 'Lỗi xử lý file') },
      { status: 500 }
    )
  }
}
