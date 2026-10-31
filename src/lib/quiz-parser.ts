export interface ParsedQuizQuestion {
  question_number: number
  content: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
  points: number
  has_answer: boolean
}

export interface ParseQuizResult {
  questions: ParsedQuizQuestion[]
  answersFoundCount: number
  missingAnswersCount: number
  rawTextPreview?: string
}

/**
 * Intelligent Quiz Parser for Vietnamese & International exam formats:
 * - Detects questions: "Câu 1:", "Câu 1.", "Question 1:", "1.", "1/ "
 * - Detects choices: "A. ... B. ... C. ... D. ..." or on separate lines
 * - Detects embedded answers:
 *   + Marks like [A], (B), *C., D* (asterisk/bold)
 *   + "Đáp án: A", "Đáp án đúng: B", "Key: C", "Chọn D"
 *   + Bottom answer sheet table: "1.A 2.B 3.C" or "1 - A, 2 - B" or "BẢNG ĐÁP ÁN: 1A 2B 3C"
 */
export function parseQuizFromText(rawText: string, externalAnswerKey?: Record<number, 'A' | 'B' | 'C' | 'D'>): ParseQuizResult {
  if (!rawText || !rawText.trim()) {
    return { questions: [], answersFoundCount: 0, missingAnswersCount: 0 }
  }

  // 1. Check for a dedicated Answer Sheet at the bottom of the document
  // E.g.: "BẢNG ĐÁP ÁN", "ĐÁP ÁN TRẮC NGHIỆM", "HƯỚNG DẪN CHẤM", "ANSWER KEY"
  const answerKeyMap: Record<number, 'A' | 'B' | 'C' | 'D'> = { ...(externalAnswerKey || {}) }
  
  const bottomKeyRegex = /(?:bảng\s+đáp\s+án|đáp\s+án\s+trắc\s+nghiệm|đáp\s+án|answer\s+key|hướng\s+dẫn\s+chấm)[\s\S]*$/i
  const bottomMatch = rawText.match(bottomKeyRegex)

  let contentText = rawText
  if (bottomMatch && bottomMatch.index !== undefined) {
    const keySection = bottomMatch[0]
    // Only strip if it looks like an answer table (contains multiple patterns like 1A, 1.A, 1:A)
    const keyPairs = [...keySection.matchAll(/(?:câu\s*)?(\d+)[\s.:\-_–—]+([A-D])\b/gi)]
    if (keyPairs.length >= 2) {
      keyPairs.forEach(m => {
        const qNum = parseInt(m[1], 10)
        const ans = m[2].toUpperCase() as 'A' | 'B' | 'C' | 'D'
        if (!answerKeyMap[qNum]) {
          answerKeyMap[qNum] = ans
        }
      })
      // Strip key section from content to avoid parsing it as questions
      contentText = rawText.slice(0, bottomMatch.index)
    }
  }

  // 2. Split into questions using regex:
  // "Câu 1:", "Câu 1.", "Bài 1:", "Question 1:", "\n1.", "\n1:"
  const questionHeaderRegex = /(?:^|\n)\s*(?:câu|bài|question)\s*(\d+)[\s.:\-_–—]+|(?:\n)\s*(\d+)[\s.:\-_–—]+(?=[A-ZÀ-Ỹ])/gi
  
  const matches: { index: number; qNum: number; headerLength: number }[] = []
  let match: RegExpExecArray | null

  while ((match = questionHeaderRegex.exec(contentText)) !== null) {
    const qNum = parseInt(match[1] || match[2], 10)
    matches.push({
      index: match.index,
      qNum: isNaN(qNum) ? matches.length + 1 : qNum,
      headerLength: match[0].length,
    })
  }

  const rawBlocks: { qNum: number; text: string }[] = []

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i].headerLength
      const end = i < matches.length - 1 ? matches[i + 1].index : contentText.length
      const blockText = contentText.slice(start, end).trim()
      rawBlocks.push({ qNum: matches[i].qNum, text: blockText })
    }
  } else {
    // Fallback: try splitting by double newline or numbered items
    const lines = contentText.split(/\n\s*\n/)
    lines.forEach((l, idx) => {
      if (l.trim().length > 10) {
        rawBlocks.push({ qNum: idx + 1, text: l.trim() })
      }
    })
  }

  const questions: ParsedQuizQuestion[] = []
  let answersFound = 0
  let missingAnswers = 0

  rawBlocks.forEach((block, idx) => {
    const qIndex = block.qNum || (idx + 1)
    let blockText = block.text

    // Check for inline answer pattern: "Đáp án: A", "Đ/A: B", "[A]", "(C)", "*A.*"
    let detectedAnswer: 'A' | 'B' | 'C' | 'D' | null = null

    // Pattern 1: Explicit answer line: "Đáp án: A" or "Chọn A"
    const explicitAnsMatch = blockText.match(/(?:đáp\s*án(?:\s*đúng)?|chọn|đ\/a|key)[\s.:\-_–—]+([A-D])\b/i)
    if (explicitAnsMatch) {
      detectedAnswer = explicitAnsMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D'
      blockText = blockText.replace(explicitAnsMatch[0], '').trim()
    }

    // Pattern 2: Marked choice with brackets or asterisk: "[A].", "*A.", "(A)"
    if (!detectedAnswer) {
      const markedMatch = blockText.match(/(?:\[|\*|\()([A-D])(?:\]|\*|\))[\s.:\-_–—]/i)
      if (markedMatch) {
        detectedAnswer = markedMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D'
      }
    }

    // Pattern 3: From bottom answer key sheet or external answer key
    if (!detectedAnswer && answerKeyMap[qIndex]) {
      detectedAnswer = answerKeyMap[qIndex]
    }

    // 3. Extract Choice A, B, C, D
    // Choices can be on separate lines or on the same line: "A. 10   B. 20   C. 30   D. 40"
    const choiceRegex = /(?:^|[\s\n])([A-D])[\s.:\-_–—)\]]+([\s\S]*?)(?=(?:[\s\n][A-D][\s.:\-_–—)\]]+)|$)/gi
    
    // Find where the choices start in the block
    const firstChoiceMatch = blockText.search(/(?:^|[\s\n])[A-D][\s.:\-_–—)\]]+/i)
    
    let content = blockText
    let optionA = ''
    let optionB = ''
    let optionC = ''
    let optionD = ''

    if (firstChoiceMatch !== -1) {
      content = blockText.slice(0, firstChoiceMatch).trim()
      const choicesText = blockText.slice(firstChoiceMatch)

      const choiceMatches = [...choicesText.matchAll(choiceRegex)]
      choiceMatches.forEach(cm => {
        const letter = cm[1].toUpperCase()
        const text = cm[2].trim()
        if (letter === 'A') optionA = text
        if (letter === 'B') optionB = text
        if (letter === 'C') optionC = text
        if (letter === 'D') optionD = text
      })
    }

    // Clean up content & choices
    content = content.replace(/\s+/g, ' ').trim()
    optionA = optionA.replace(/\s+/g, ' ').trim()
    optionB = optionB.replace(/\s+/g, ' ').trim()
    optionC = optionC.replace(/\s+/g, ' ').trim()
    optionD = optionD.replace(/\s+/g, ' ').trim()

    const hasAnswer = Boolean(detectedAnswer)
    if (hasAnswer) answersFound++
    else missingAnswers++

    questions.push({
      question_number: qIndex,
      content: content || `Câu hỏi ${qIndex}`,
      option_a: optionA || 'Đáp án A',
      option_b: optionB || 'Đáp án B',
      option_c: optionC || 'Đáp án C',
      option_d: optionD || 'Đáp án D',
      correct_answer: (detectedAnswer || 'A') as 'A' | 'B' | 'C' | 'D',
      points: 1,
      has_answer: hasAnswer,
    })
  })

  return {
    questions,
    answersFoundCount: answersFound,
    missingAnswersCount: missingAnswers,
    rawTextPreview: rawText.slice(0, 500)
  }
}

/**
 * Parse an Answer Key string/file (e.g., "1A 2B 3C 4D" or "1.A, 2.B, 3.C")
 */
export function parseAnswerKeyString(input: string): Record<number, 'A' | 'B' | 'C' | 'D'> {
  const result: Record<number, 'A' | 'B' | 'C' | 'D'> = {}
  if (!input) return result

  const regex = /(?:câu\s*)?(\d+)[\s.:\-_–—]*([A-D])\b/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(input)) !== null) {
    const qNum = parseInt(match[1], 10)
    const ans = match[2].toUpperCase() as 'A' | 'B' | 'C' | 'D'
    if (!isNaN(qNum)) {
      result[qNum] = ans
    }
  }

  return result
}
