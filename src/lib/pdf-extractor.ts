import { getGeminiApiKey } from './gemini-ai'

/**
 * Polyfill Canvas & Web APIs required by pdfjs-dist in Node.js server environments
 */
export function ensureCanvasPolyfills() {
  if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;
      constructor(init?: any) {
        if (Array.isArray(init)) {
          this.a = init[0] ?? 1; this.b = init[1] ?? 0;
          this.c = init[2] ?? 0; this.d = init[3] ?? 1;
          this.e = init[4] ?? 0; this.f = init[5] ?? 0;
        }
      }
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
      transformPoint(p: any) { return p; }
      inverse() { return this; }
    };
  }

  if (typeof (globalThis as any).Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D {
      constructor(init?: any) {}
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    };
  }

  if (typeof (globalThis as any).ImageData === 'undefined') {
    (globalThis as any).ImageData = class ImageData {
      width = 0;
      height = 0;
      data = new Uint8ClampedArray(0);
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    };
  }
}

/**
 * Robust PDF Text Extractor with automatic DOMMatrix polyfills
 * and intelligent Gemini multimodal OCR fallback if needed
 */
export async function extractTextFromPDF(arrayBuffer: ArrayBuffer, customApiKey?: string): Promise<string> {
  ensureCanvasPolyfills()

  let extractedText = ''
  let localParseError: any = null

  // 1. Try local PDF parser first
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: new Uint8Array(arrayBuffer) })
    const textResult = await parser.getText()
    extractedText = textResult?.text || ''
    await parser.destroy()
  } catch (err: any) {
    console.warn('Local PDFParse failed, checking fallback:', err?.message)
    localParseError = err
  }

  // 2. If local parsing succeeded and extracted meaningful text, return it
  if (extractedText && extractedText.trim().length > 30) {
    return extractedText.trim()
  }

  // 3. Fallback: If local parser failed or extracted text is empty (e.g. scanned image PDF),
  // use Google Gemini multimodal PDF reading!
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

  return ''
}
