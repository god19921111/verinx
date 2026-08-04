import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '@/lib/api'
import type { CheckinStatus, Question } from '@/types'
import { BouncyButton } from '@/components/BouncyButton'
import { QuestionCard } from '@/components/QuestionCard'
import { ScoreCard } from '@/components/ScoreCard'
import { DisclaimerBanner } from '@/components/DisclaimerBanner'
import { StreakDisplay } from '@/components/Gamification'
import { playSound } from '@/lib/sound'
import { sfx } from '@/lib/sfx'

type SubMode = 'random' | 'category'
type Step = 'select' | 'thinking' | 'answering' | 'scoring' | 'done'

const CATEGORIES = ['综合分析', '人际沟通', '应急应变', '组织管理', '自我认知']

export function CheckinPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const retryId = searchParams.get('retry')
  const { isAuthenticated } = useAuthStore()

  const [checkin, setCheckin] = useState<CheckinStatus | null>(null)
  const [subMode, setSubMode] = useState<SubMode>('random')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [step, setStep] = useState<Step>('select')
  const [question, setQuestion] = useState<Question | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [scoreResult, setScoreResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [newBadges, setNewBadges] = useState<any[]>([])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    api.get('/stats/checkin-status')
      .then((r) => setCheckin(r.data.data || r.data))
      .catch(() => {})
  }, [isAuthenticated, navigate])

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat)
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    )
  }

  const fetchQuestion = async (): Promise<Question | null> => {
    try {
      if (retryId) {
        const res = await api.get(`/questions/${retryId}`)
        const data = res.data.data || res.data
        if (data?.content) return data as Question
      }

      let url = '/questions/random'
      const params: Record<string, string> = {}

      if (subMode === 'category' && selectedCategories.length > 0) {
        params.category = selectedCategories[0]
      }

      const res = await api.get(url, { params })
      const data = res.data.data || res.data
      if (data?.content) {
        return data as Question
      }
    } catch {
      try {
        const res = await api.post('/ai/generate-question', null, {
          params: { random_category: subMode === 'random' },
          timeout: 60000,
        })
        const data = res.data.data || res.data
        return {
          id: 'ai-generated',
          content: data.content,
          category: data.category || '综合分析',
          difficulty: data.difficulty || 3,
          answer_reference: data.answer_reference || '',
          exam_type: '省考',
          created_at: new Date().toISOString(),
        }
      } catch {}
    }
    return null
  }

  const handleStart = async () => {
    if (!retryId && subMode === 'category' && selectedCategories.length === 0) {
      return
    }
    setLoading(true)
    setSubmitError(null)
    const q = await fetchQuestion()
    setLoading(false)
    if (q) {
      setQuestion(q)
      setStep('thinking')
    } else {
      setSubmitError('出题失败，请稍后重试')
    }
  }

  const handleSubmitAnswer = async () => {
    if (!question) return
    if (!answerText.trim()) {
      setSubmitError('请先输入你的答案')
      return
    }
    setSubmitError(null)
    setLoading(true)
    setStep('scoring')

    try {
      try {
        await api.post('/practice', {
          question_id: question.id,
          practice_mode: 'single',
          answer_text: answerText,
        })
      } catch {}

      const scoreRes = await api.post('/ai/score', {
        question_content: question.content,
        answer_text: answerText,
        question_category: question.category,
      }, { timeout: 120000 })
      const scoreData = scoreRes.data.data || scoreRes.data
      setScoreResult(scoreData)

      await api.post('/stats/checkin-record', {
        category: question.category,
        score: scoreData.score_overall ?? 0,
      }).then(r => {
        const data = r.data.data || r.data
        setCheckin(prev => prev ? {
          ...prev,
          checked_today: true,
          streak_days: data.streak_days ?? prev.streak_days,
        } : prev)
      }).catch(() => {})

      setStep('done')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || '评分服务异常'
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
      })
      setStep('done')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setStep('select')
    setQuestion(null)
    setAnswerText('')
    setScoreResult(null)
    setSubmitError(null)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 text-center">
      <div className="mb-10" style={{ animation: 'fadeInDown 500ms ease-out forwards' }}>
        <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.2em] mb-2">
          DAILY CHECK-IN
        </div>
        <h1 className="font-display text-3xl tracking-tight">
          每日打卡
        </h1>
      </div>

      {step === 'select' && (
        <div className="space-y-6" style={{ animation: 'fadeInUp 600ms ease-out 200ms both' }}>
          {retryId ? (
            <div className="border border-[rgba(240,240,250,0.08)] p-5 text-left">
              <div className="text-[11px] uppercase-spacex tracking-[0.2em] text-[#808080] mb-1">
                再次挑战
              </div>
              <p className="text-xs text-[rgba(240,240,250,0.5)] font-body mb-4">
                同一道题重新作答
              </p>
              <button
                className="border border-[rgba(240,240,250,0.12)] px-8 py-2.5 hover:bg-[rgba(240,240,250,0.05)] transition-spacex disabled:opacity-50"
                onClick={handleStart}
                disabled={loading}
              >
                <span className="text-[11px] uppercase-spacex tracking-[0.15em]">
                  {loading ? '加载中...' : '开始作答 →'}
                </span>
              </button>
            </div>
          ) : (
            <div className="border border-[rgba(240,240,250,0.08)] p-6 text-left space-y-4">
              {/* 模式切换 + 题型 + 按钮 整合 */}
              <div className="flex items-center gap-0">
                <button
                  onClick={() => { setSubMode('random'); playSound('click') }}
                  className={`px-4 py-1.5 text-[11px] uppercase-spacex tracking-[0.15em] border-b-2 transition-spacex ${
                    subMode === 'random'
                      ? 'border-[rgba(240,240,250,0.4)] text-[#F0F0FA]'
                      : 'border-transparent text-[rgba(240,240,250,0.35)] hover:text-[rgba(240,240,250,0.6)]'
                  }`}
                >
                  随机刷题
                </button>
                <button
                  onClick={() => { setSubMode('category'); playSound('click') }}
                  className={`px-4 py-1.5 text-[11px] uppercase-spacex tracking-[0.15em] border-b-2 transition-spacex ${
                    subMode === 'category'
                      ? 'border-[rgba(240,240,250,0.4)] text-[#F0F0FA]'
                      : 'border-transparent text-[rgba(240,240,250,0.35)] hover:text-[rgba(240,240,250,0.6)]'
                  }`}
                >
                  指定题型
                </button>
              </div>

              {subMode === 'category' && (
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { toggleCategory(cat); playSound('click') }}
                      className={`px-3 py-1 text-[11px] border transition-spacex ${
                        selectedCategories.includes(cat)
                          ? 'border-[rgba(240,240,250,0.3)] text-[#F0F0FA] bg-[rgba(240,240,250,0.05)]'
                          : 'border-[rgba(240,240,250,0.08)] text-[rgba(240,240,250,0.4)] hover:border-[rgba(240,240,250,0.2)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {submitError && (
                <p className="text-xs text-[rgba(239,68,68,0.8)]">{submitError}</p>
              )}

              <div>
                <button
                  className="group relative border border-[rgba(240,240,250,0.12)] px-10 py-3 hover:bg-[rgba(240,240,250,0.05)] hover:border-[rgba(240,240,250,0.3)] transition-spacex disabled:opacity-50 overflow-hidden"
                  onClick={() => { playSound('click'); handleStart() }}
                  disabled={loading || (subMode === 'category' && selectedCategories.length === 0)}
                >
                  <span className="relative z-10 text-[11px] uppercase-spacex tracking-[0.15em]">
                    {loading ? '出题中...' : '开始练习 →'}
                  </span>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(240,240,250,0.06), transparent)' }}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 'thinking' && question && (
        <div className="space-y-6" style={{ animation: 'fadeInUp 500ms ease-out forwards' }}>
          <QuestionCard question={question} />
          <p className="text-sm text-[#808080] text-center">
            仔细思考，准备好后开始答题
          </p>
          <div className="text-center">
            <button
              className="group relative border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex overflow-hidden"
              onClick={() => { sfx.stepTransition(); setStep('answering') }}
            >
              <span className="relative z-10 text-xs uppercase-spacex tracking-[0.15em]">
                开始答题
              </span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(240,240,250,0.08), transparent)' }}
              />
            </button>
          </div>
        </div>
      )}

      {step === 'answering' && (
        <div className="space-y-6" style={{ animation: 'fadeInUp 400ms ease-out forwards' }}>
          {question && (
            <div className="border border-[rgba(240,240,250,0.35)] p-8">
              <p className="text-[rgba(240,240,250,0.9)] font-body leading-relaxed">
                {question.content}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs uppercase-spacex tracking-[0.1em] text-[#808080] mb-4">
              文字作答
            </label>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="请在此输入你的答案..."
              rows={8}
              className="w-full border border-[rgba(240,240,250,0.35)] bg-transparent px-4 py-4 text-[#F0F0FA] font-body placeholder:text-[#808080] focus:border-[#F0F0FA] focus:outline-none resize-none transition-spacex"
            />
          </div>

          {submitError && (
            <p className="text-sm text-[rgba(239,68,68,0.9)] text-center">{submitError}</p>
          )}

          <button
            className="group relative w-full border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex disabled:opacity-50 overflow-hidden"
            onClick={() => { sfx.submit(); handleSubmitAnswer() }}
            disabled={loading}
          >
            <span className="relative z-10 text-xs uppercase-spacex tracking-[0.15em]">
              {loading ? 'AI评分中...' : '提交答案'}
            </span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(240,240,250,0.06), transparent)' }}
            />
          </button>
        </div>
      )}

      {step === 'scoring' && (
        <div className="border border-[rgba(240,240,250,0.35)] p-16 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-3 h-3 bg-[#F0F0FA] animate-pulse" />
            <div className="w-3 h-3 bg-[rgba(240,240,250,0.5)] animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-3 h-3 bg-[rgba(240,240,250,0.3)] animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <p className="font-display text-xl tracking-tight">VERINX 正在分析你的回答</p>
          <p className="mt-3 text-sm text-[#808080]">从四个维度逐句拆解，稍等几秒...</p>
        </div>
      )}

      {step === 'done' && scoreResult && (
        <div className="space-y-6">
          {/* 星际续航日志 */}
          {checkin && (
            <StreakDisplay
              streakDays={checkin.streak_days}
              maxStreakDays={checkin.max_streak_days}
            />
          )}

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
            answerReference={question?.answer_reference ?? undefined}
          />

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleRetry}
              className="border border-[rgba(240,240,250,0.12)] px-10 py-2.5 hover:bg-[rgba(240,240,250,0.05)] transition-spacex"
            >
              <span className="text-[11px] uppercase-spacex tracking-[0.15em]">
                再来一次
              </span>
            </button>
          </div>

          <DisclaimerBanner />
        </div>
      )}
    </div>
  )
}
