import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ExamTimer } from '@/components/ExamTimer'
import { AudioRecorder } from '@/components/AudioRecorder'
import { QuestionCard } from '@/components/QuestionCard'
import { ScoreCard } from '@/components/ScoreCard'
import { DisclaimerBanner } from '@/components/DisclaimerBanner'
import api, { uploadAudio, recognizeSpeech } from '@/lib/api'
import type { Question } from '@/types'
import { useAuthStore } from '@/store/authStore'

type Phase = 'thinking' | 'answering' | 'scoring' | 'result'

export function SinglePracticePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const questionId = searchParams.get('questionId')
  const { isAuthenticated } = useAuthStore()

  const [question, setQuestion] = useState<Question | null>(null)
  const [phase, setPhase] = useState<Phase>('thinking')
  const [answerText, setAnswerText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [practiceId, setPracticeId] = useState<string | null>(null)
  const [scoreResult, setScoreResult] = useState<any>(null)
  const [thinkingTimedOut, setThinkingTimedOut] = useState(false)
  const [answeringTimedOut, setAnsweringTimedOut] = useState(false)
  const [processingAudio, setProcessingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  // Fetch question
  useEffect(() => {
    if (!questionId) {
      setLoading(false)
      return
    }
    api.get(`/questions/${questionId}`)
      .then((res) => {
        const data = res.data.data || res.data
        setQuestion(data)
      })
      .catch(() => setQuestion(null))
      .finally(() => setLoading(false))
  }, [questionId])

  const handleTranscript = useCallback((text: string) => {
    setAnswerText((prev) => prev ? prev + '\n' + text : text)
  }, [])

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setProcessingAudio(true)
    setAudioError(null)
    try {
      const audioUrl = await uploadAudio(blob)
      const text = await recognizeSpeech(audioUrl)
      if (text && !text.includes('请配置')) {
        setAnswerText((prev) => prev ? prev + '\n' + text : text)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || '语音识别失败，请检查网络或使用文字输入'
      setAudioError(msg)
    } finally {
      setProcessingAudio(false)
    }
  }, [])

  const handleStartAnswering = () => setPhase('answering')

  const handleSubmit = async () => {
    if (!question) return
    if (!answerText.trim()) {
      setSubmitError('请先输入答案或使用语音答题')
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    setPhase('scoring')

    try {
      // 1. Create practice record
      const practiceRes = await api.post('/practice', {
        question_id: question.id,
        practice_mode: 'single',
        answer_text: answerText,
      })
      const record = practiceRes.data.data || practiceRes.data
      setPracticeId(record.id)

      // 2. Request AI scoring
      const scoreRes = await api.post('/ai/score', {
        question_content: question.content,
        answer_text: answerText,
        question_category: question.category,
      })
      const scoreData = scoreRes.data.data || scoreRes.data
      setScoreResult(scoreData)

      // 3. Save score to practice record
      if (record.id) {
        try {
          await api.put(`/practice/${record.id}`, {
            score_overall: scoreData.score_overall,
            score_analysis: scoreData.score_analysis,
            score_expression: scoreData.score_expression,
            score_adaptability: scoreData.score_adaptability,
            score_organization: scoreData.score_organization,
            report_content: scoreData.report_content,
            dimension_analysis: scoreData.dimension_analysis,
            deduction_points: scoreData.deduction_points,
            optimization_suggestions: scoreData.optimization_suggestions,
          })
        } catch (saveErr) {
          console.error('保存评分结果失败:', saveErr)
        }
      }

      setPhase('result')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || '评分服务异常，请稍后重试'
      setScoreResult({
        score_overall: 0,
        score_analysis: 0,
        score_expression: 0,
        score_adaptability: 0,
        score_organization: 0,
        report_content: msg,
        dimension_analysis: {},
        deduction_points: '',
        optimization_suggestions: '',
        weights: { analysis: 0.30, expression: 0.25, adaptability: 0.25, organization: 0.20 },
      })
      setPhase('result')
    } finally {
      setSubmitting(false)
    }
  }

  const handleThinkingTimeout = useCallback(() => {
    setThinkingTimedOut(true)
    setPhase('answering')
  }, [])

  const handleAnsweringTimeout = useCallback(() => {
    setAnsweringTimedOut(true)
    if (answerText.trim()) {
      handleSubmit()
    }
  }, [answerText])

  const phaseLabels = ['思考', '答题', '评分']
  const phaseIndex = phase === 'thinking' ? 0 : phase === 'answering' ? 1 : 2

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="py-12 text-center text-gray-400">加载题目中...</div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <p className="text-gray-500">未找到题目，请从题库选择</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate('/questions')}>
            返回题库
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold text-gray-900">专项训练</h1>

      {/* Question Display */}
      <div className="mt-4">
        <QuestionCard question={question} />
      </div>

      {/* Timer */}
      {phase !== 'result' && (
        <div className="mt-4">
          <ExamTimer
            mode={phase === 'thinking' ? 'thinking' : 'answering'}
            maxSeconds={phase === 'thinking' ? 180 : 300}
            onTimeout={phase === 'thinking' ? handleThinkingTimeout : handleAnsweringTimeout}
            isRunning={phase === 'thinking' || phase === 'answering'}
          />
        </div>
      )}

      {/* Phase Indicator */}
      <div className="mt-4 flex items-center gap-1">
        {phaseLabels.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col items-center">
            <div className={`w-full h-1.5 rounded-full ${
              i <= phaseIndex ? 'bg-primary' : 'bg-gray-200'
            }`} />
            <span className={`mt-1.5 text-xs ${
              i <= phaseIndex ? 'text-primary font-medium' : 'text-gray-400'
            }`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Thinking Phase */}
      {phase === 'thinking' && (
        <div className="mt-6 text-center">
          {thinkingTimedOut ? (
            <p className="text-sm text-amber-600 mb-3">思考时间已到，请开始答题</p>
          ) : (
            <p className="text-sm text-gray-500 mb-3">请在思考时间内整理思路，准备好后点击开始答题</p>
          )}
          <Button size="lg" onClick={handleStartAnswering}>
            开始答题
          </Button>
        </div>
      )}

      {/* Answering Phase */}
      {phase === 'answering' && (
        <div className="mt-6 space-y-4">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onTranscript={handleTranscript}
            processing={processingAudio}
          />

          {audioError && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{audioError}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">文字作答</label>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="请在此输入你的答案..."
              rows={6}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-500 text-center">{submitError}</p>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={submitting || processingAudio}
          >
            {submitting ? '提交中...' : '提交答案'}
          </Button>

          {answeringTimedOut && (
            <p className="text-sm text-amber-600 text-center">答题时间已到</p>
          )}
        </div>
      )}

      {/* Scoring Phase */}
      {phase === 'scoring' && (
        <div className="mt-6 rounded-xl border border-green-100 bg-green-50 p-6 text-center">
          <p className="text-green-700 font-medium">答案已提交</p>
          <p className="mt-2 text-sm text-green-600">AI正在评分中，请稍候...</p>
        </div>
      )}

      {/* Result Phase */}
      {phase === 'result' && scoreResult && (
        <div className="mt-6 space-y-6">
          <ScoreCard
            overall={scoreResult.score_overall ?? 0}
            scores={{
              analysis: scoreResult.score_analysis ?? 0,
              expression: scoreResult.score_expression ?? 0,
              adaptability: scoreResult.score_adaptability ?? 0,
              organization: scoreResult.score_organization ?? 0,
            }}
            weights={{
              analysis: scoreResult.weights?.analysis ?? 0.30,
              expression: scoreResult.weights?.expression ?? 0.25,
              adaptability: scoreResult.weights?.adaptability ?? 0.25,
              organization: scoreResult.weights?.organization ?? 0.20,
            }}
            reportContent={scoreResult.report_content}
            dimensionAnalysis={scoreResult.dimension_analysis}
            deductionPoints={scoreResult.deduction_points}
            optimizationSuggestions={scoreResult.optimization_suggestions}
          />

          <Button variant="outline" className="w-full" onClick={() => navigate('/questions')}>
            继续练习
          </Button>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </div>
  )
}
