import { getGeminiApiKey } from './gemini-ai'

/**
 * Robust PDF Text Extractor using rock-solid pdf-parse 1.1.1 (pure Node.js, zero worker dependencies)
 * with automatic Gemini multimodal OCR fallback if needed
 */
export async function extractTextFromPDF(arrayBuffer: ArrayBuffer, customApiKey?: string): Promise<string> {
  let extractedText = ''
  let localParseError: any = null

  // 1. Try local PDF parser (pdf-parse 1.1.1)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdf = require('pdf-parse')
    const buffer = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer)
    const data = await pdf(buffer)
    extractedText = data?.text || ''
  } catch (err: any) {
    console.warn('Local pdf-parse failed:', err?.message)
    localParseError = err
  }

  // 2. If local parsing extracted meaningful text, return it
  if (extractedText && extractedText.trim().length > 30) {
    return extractedText.trim()
  }

  // 3. Fallback: Multimodal OCR via Google Gemini (works on scanned image PDFs as well)
  try {
    const apiKey = customApiKey || await getGeminiApiKey()
    if (apiKey) {
      const base64Data = Buffer.from(arrayBuffer).toString('base64')
      const prompt = `Trích xuất và đọc đầy đủ toàn bộ nội dung văn bản, câu hỏi trắc nghiệm, các lựa chọn A, B, C, D và phần tự luận có trong tài liệu PDF này. Hãy giữ nguyên định dạng các câu hỏi (ví dụ: Câu 1, Câu 2... A., B., C., D.) và bảng đáp án nếu có.`

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: base64Data
                }
              }
            ]
          }]
        })
      })

      if (res.ok) {
        const json = await res.json()
        const geminiText = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (geminiText && geminiText.trim().length > 20) {
          return geminiText.trim()
        }
      }
    }
  } catch (geminiErr) {
    console.warn('Gemini PDF OCR fallback failed:', geminiErr)
  }

  if (extractedText && extractedText.trim()) {
    return extractedText.trim()
  }

  if (localParseError) {
    throw new Error('Lỗi đọc nội dung file PDF: ' + (localParseError.message || 'Không thể trích xuất văn bản'))
  }

  throw new Error('Không thể đọc nội dung file PDF. Vui lòng kiểm tra lại file hoặc chuyển sang file Word (.docx) để quét.')
}
