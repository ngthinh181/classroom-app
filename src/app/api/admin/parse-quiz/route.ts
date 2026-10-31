import { NextRequest, NextResponse } from 'next/server'
import mammoth from 'mammoth'
import { parseQuizFromText, parseAnswerKeyString } from '@/lib/quiz-parser'

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

    // 1. Parse File Content based on extension
    if (fileName.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      extractedText = result.value
    } else if (fileName.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer()
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) })
      const textResult = await parser.getText()
      extractedText = textResult.text || ''
      await parser.destroy()
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      extractedText = await file.text()
    } else {
      return NextResponse.json(
        { error: 'Định dạng file không hỗ trợ. Vui lòng tải file .pdf, .docx, .txt, hoặc .xlsx' },
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
        const { PDFParse } = await import('pdf-parse')
        const akParser = new PDFParse({ data: new Uint8Array(akBuf) })
        const akTextResult = await akParser.getText()
        akText = akTextResult.text || ''
        await akParser.destroy()
      } else {
        akText = await answerKeyFile.text()
      }
      answerKeyMap = { ...answerKeyMap, ...parseAnswerKeyString(akText) }
    }

    // 3. Intelligently scan questions and answers
    const parsed = parseQuizFromText(extractedText, answerKeyMap)

    return NextResponse.json({
      success: true,
      fileName: file.name,
      ...parsed,
    })
  } catch (err: any) {
    console.error('Quiz scan API error:', err)
    return NextResponse.json(
      { error: 'Không thể phân tích file: ' + (err.message || 'Lỗi xử lý file') },
      { status: 500 }
    )
  }
}
