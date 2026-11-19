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
  essayContent?: string
  hasEssay?: boolean
  hasQuiz?: boolean
  isHybrid?: boolean
  suggestedQuizPoints?: number
  suggestedEssayPoints?: number
  rawTextPreview?: string
}

/**
 * Intelligent Quiz & Hybrid Exam Parser for Vietnamese & International formats:
 * - Detects both Multiple Choice (Trắc nghiệm) AND Essay (Tự luận) in the same file.
 * - Extracts MCQs and detects choices A, B, C, D and embedded answer keys.
 * - Separates essay sections ("Phần II: Tự luận", "Bài 1 tự luận"...) to combine seamlessly.
 * - Intelligently estimates points distribution between Quiz & Essay (e.g., 7đ - 3đ or 5đ - 5đ).
 */
export function parseQuizFromText(rawText: string, externalAnswerKey?: Record<number, 'A' | 'B' | 'C' | 'D'>): ParseQuizResult {
  if (!rawText || !rawText.trim()) {
    return { questions: [], answersFoundCount: 0, missingAnswersCount: 0, hasEssay: false, hasQuiz: false, isHybrid: false }
  }

  // 1. Check for a dedicated Answer Sheet at the bottom of the document
  const answerKeyMap: Record<number, 'A' | 'B' | 'C' | 'D'> = { ...(externalAnswerKey || {}) }
  
  const bottomKeyRegex = /(?:bảng\s+đáp\s+án|đáp\s+án\s+trắc\s+nghiệm|đáp\s+án|answer\s+key|hướng\s+dẫn\s+chấm)[\s\S]*$/i
  const bottomMatch = rawText.match(bottomKeyRegex)

  let contentText = rawText
  if (bottomMatch && bottomMatch.index !== undefined) {
    const keySection = bottomMatch[0]
    const keyPairs = [...keySection.matchAll(/(?:câu\s*)?(\d+)[\s.:\-_–—]+([A-D])\b/gi)]
    if (keyPairs.length >= 2) {
      keyPairs.forEach(m => {
        const qNum = parseInt(m[1], 10)
        const ans = m[2].toUpperCase() as 'A' | 'B' | 'C' | 'D'
        if (!answerKeyMap[qNum]) {
          answerKeyMap[qNum] = ans
        }
      })
      contentText = rawText.slice(0, bottomMatch.index)
    }
  }

  // 2. Detect Points Distribution (e.g., "TRẮC NGHIỆM (7 điểm)", "TỰ LUẬN (3 điểm)")
  let detectedQuizPoints: number | undefined
  let detectedEssayPoints: number | undefined

  const qPtsMatch = contentText.match(/(?:trắc\s*nghiệm)[\s\S]{0,40}?[(\[]\s*(\d+(?:[.,]\d+)?)\s*(?:điểm|đ)[)\]]/i)
  if (qPtsMatch) {
    detectedQuizPoints = parseFloat(qPtsMatch[1].replace(',', '.'))
  }

  const ePtsMatch = contentText.match(/(?:tự\s*luận)[\s\S]{0,40}?[(\[]\s*(\d+(?:[.,]\d+)?)\s*(?:điểm|đ)[)\]]/i)
  if (ePtsMatch) {
    detectedEssayPoints = parseFloat(ePtsMatch[1].replace(',', '.'))
  }

  // 3. Separate MCQ content vs Essay content
  let quizContent = contentText
  let essayContent = ''

  const essayHeaderRegex = /(?:^|\n)\s*(?:(?:phần\s*(?:ii|2|b|hai)[\s.:\-_–—]+)?tự\s*luận|phần\s*(?:ii|2|b|hai)[\s.:\-_–—]+tự\s*luận|phần\s*tự\s*luận|\b(?:ii|b)[\s.:\-_–—]+\s*tự\s*luận)/i
  const essayMatch = contentText.match(essayHeaderRegex)

  if (essayMatch && essayMatch.index !== undefined) {
    quizContent = contentText.slice(0, essayMatch.index).trim()
    essayContent = contentText.slice(essayMatch.index).trim()
  }

  // 4. Split quiz content into question blocks
  const questionHeaderRegex = /(?:^|\n)\s*(?:câu|bài|question)\s*(\d+)[\s.:\-_–—]+|(?:\n)\s*(\d+)[\s.:\-_–—]+(?=[A-ZÀ-Ỹ])/gi
  
  const matches: { index: number; qNum: number; headerLength: number }[] = []
  let match: RegExpExecArray | null

  while ((match = questionHeaderRegex.exec(quizContent)) !== null) {
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
      const end = i < matches.length - 1 ? matches[i + 1].index : quizContent.length
      const blockText = quizContent.slice(start, end).trim()
      rawBlocks.push({ qNum: matches[i].qNum, text: blockText })
    }
  } else {
    const lines = quizContent.split(/\n\s*\n/)
    lines.forEach((l, idx) => {
      if (l.trim().length > 10) {
        rawBlocks.push({ qNum: idx + 1, text: l.trim() })
      }
    })
  }

  const questions: ParsedQuizQuestion[] = []
  const extraEssayQuestions: string[] = []
  let answersFound = 0
  let missingAnswers = 0

  rawBlocks.forEach((block, idx) => {
    const qIndex = block.qNum || (idx + 1)
    let blockText = block.text

    // Check for inline answer pattern
    let detectedAnswer: 'A' | 'B' | 'C' | 'D' | null = null

    const explicitAnsMatch = blockText.match(/(?:đáp\s*án(?:\s*đúng)?|chọn|đ\/a|key)[\s.:\-_–—]+([A-D])\b/i)
    if (explicitAnsMatch) {
      detectedAnswer = explicitAnsMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D'
      blockText = blockText.replace(explicitAnsMatch[0], '').trim()
    }

    if (!detectedAnswer) {
      const markedMatch = blockText.match(/(?:\[|\*|\()([A-D])(?:\]|\*|\))[\s.:\-_–—]/i)
      if (markedMatch) {
        detectedAnswer = markedMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D'
      }
    }

    if (!detectedAnswer && answerKeyMap[qIndex]) {
      detectedAnswer = answerKeyMap[qIndex]
    }

    // Extract Choices A, B, C, D
    const choiceRegex = /(?:^|[\s\n])([A-D])[\s.:\-_–—)\]]+([\s\S]*?)(?=(?:[\s\n][A-D][\s.:\-_–—)\]]+)|$)/gi
    const firstChoiceMatch = blockText.search(/(?:^|[\s\n])[A-D][\s.:\-_–—)\]]+/i)
    
    let content = blockText
    let optionA = ''
    let optionB = ''
    let optionC = ''
    let optionD = ''
    let validChoicesCount = 0

    if (firstChoiceMatch !== -1) {
      content = blockText.slice(0, firstChoiceMatch).trim()
      const choicesText = blockText.slice(firstChoiceMatch)

      const choiceMatches = [...choicesText.matchAll(choiceRegex)]
      choiceMatches.forEach(cm => {
        const letter = cm[1].toUpperCase()
        const text = cm[2].trim()
        if (letter === 'A' && text) { optionA = text; validChoicesCount++ }
        if (letter === 'B' && text) { optionB = text; validChoicesCount++ }
        if (letter === 'C' && text) { optionC = text; validChoicesCount++ }
        if (letter === 'D' && text) { optionD = text; validChoicesCount++ }
      })
    }

    // A question is ONLY a valid Multiple Choice Question if it has at least 2 real options (e.g. A and B).
    // If it has fewer than 2 choices, it is a Math exercise or Essay problem!
    if (validChoicesCount < 2) {
      if (blockText.trim().length > 10) {
        extraEssayQuestions.push(`Bài ${qIndex}: ${blockText.trim()}`)
      }
      return
    }

    content = content.replace(/\s+/g, ' ').trim()
    optionA = optionA.replace(/\s+/g, ' ').trim()
    optionB = optionB.replace(/\s+/g, ' ').trim()
    optionC = optionC.replace(/\s+/g, ' ').trim()
    optionD = optionD.replace(/\s+/g, ' ').trim()

    const hasAnswer = Boolean(detectedAnswer)
    if (hasAnswer) answersFound++
    else missingAnswers++

    questions.push({
      question_number: questions.length + 1,
      content: content || `Câu hỏi ${qIndex}`,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC || optionA,
      option_d: optionD || optionB,
      correct_answer: (detectedAnswer || 'A') as 'A' | 'B' | 'C' | 'D',
      points: 1,
      has_answer: hasAnswer,
    })
  })

  // Combine essay questions if found in questions block
  if (extraEssayQuestions.length > 0) {
    if (!essayContent) {
      essayContent = 'PHẦN TỰ LUẬN:\n' + extraEssayQuestions.join('\n\n')
    } else {
      essayContent = essayContent + '\n\n' + extraEssayQuestions.join('\n\n')
    }
  }

  const hasEssay = Boolean(essayContent && essayContent.trim().length > 10)
  const hasQuiz = questions.length > 0
  const isHybrid = hasEssay && hasQuiz

  // Intelligently distribute points between MCQ and Essay
  let suggestedQuizPoints = 10
  let suggestedEssayPoints = 0

  if (isHybrid) {
    if (detectedQuizPoints && detectedQuizPoints > 0) {
      suggestedQuizPoints = detectedQuizPoints
      suggestedEssayPoints = detectedEssayPoints || Math.max(0, 10 - detectedQuizPoints)
    } else if (detectedEssayPoints && detectedEssayPoints > 0) {
      suggestedEssayPoints = detectedEssayPoints
      suggestedQuizPoints = Math.max(1, 10 - detectedEssayPoints)
    } else {
      // Default: 7 points for quiz, 3 points for essay (Vietnamese standard)
      suggestedQuizPoints = questions.length <= 6 ? 5 : 7
      suggestedEssayPoints = 10 - suggestedQuizPoints
    }

    const perQuestionPoint = Math.round((suggestedQuizPoints / questions.length) * 100) / 100
    questions.forEach(q => {
      q.points = perQuestionPoint
    })
  } else if (!hasQuiz && hasEssay) {
    suggestedQuizPoints = 0
    suggestedEssayPoints = 10
  }

  return {
    questions,
    answersFoundCount: answersFound,
    missingAnswersCount: missingAnswers,
    essayContent: hasEssay ? essayContent.trim() : undefined,
    hasEssay,
    hasQuiz,
    isHybrid,
    suggestedQuizPoints,
    suggestedEssayPoints,
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

const EXPLANATION_TAG_START = '<!--EXPLANATION:'
const EXPLANATION_TAG_END = '-->'

export function cleanQuestionContent(content: string | null | undefined): string {
  if (!content) return ''
  return content.replace(/<!--EXPLANATION:[\s\S]*?-->/g, '').trim()
}

export function getQuestionExplanation(content: string | null | undefined): string {
  if (!content) return ''
  const startIdx = content.indexOf(EXPLANATION_TAG_START)
  if (startIdx === -1) return ''
  const endIdx = content.indexOf(EXPLANATION_TAG_END, startIdx)
  if (endIdx === -1) return ''
  return content.substring(startIdx + EXPLANATION_TAG_START.length, endIdx).trim()
}

export function encodeQuestionWithExplanation(content: string, explanation: string): string {
  const clean = cleanQuestionContent(content)
  if (!explanation || !explanation.trim()) return clean
  return `${clean}\n${EXPLANATION_TAG_START}${explanation.trim()}${EXPLANATION_TAG_END}`
}

