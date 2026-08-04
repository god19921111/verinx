import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ExamTimer } from '@/components/ExamTimer'
import { QuestionCard } from '@/components/QuestionCard'
import { ScoreCard } from '@/components/ScoreCard'
import { DisclaimerBanner } from '@/components/DisclaimerBanner'
import api from '@/lib/api'
import { sfx } from '@/lib/sfx'
import type { Question } from '@/types'
import { useAuthStore } from '@/store/authStore'

type Step = 'waiting' | 'thinking' | 'answering' | 'scoring'

const steps: { key: Step; label: string; maxSeconds: number }[] = [
  { key: 'waiting', label: '候考', maxSeconds: 30 },
  { key: 'thinking', label: '思考', maxSeconds: 120 },
  { key: 'answering', label: '答题', maxSeconds: 240 },
  { key: 'scoring', label: '评分', maxSeconds: 0 },
]

interface ScoreRecord {
  overall: number
  analysis: number
  expression: number
  adaptability: number
  organization: number
  category: string
}

function getVerinxComment(thisScore: number, prevScore: number | null, roundNum: number): string {
  const diff = prevScore !== null ? thisScore - prevScore : 0
  const firstTime = prevScore === null

  // 首题点评
  if (firstTime) {
    if (thisScore >= 80) return '第一题就 80+，有点东西，继续保持这个状态。'
    if (thisScore >= 70) return '首题 70+，基础不错，但还没到稳的程度。'
    if (thisScore >= 60) return '第一题过了及格线，后面还有拉升空间。'
    return '首题没及格，别慌，先看问题出在哪。'
  }

  // 对比题点评
  if (diff >= 10) return `上一题 ${prevScore}，这题 ${thisScore}，猛涨 ${diff} 分，状态起来了。`
  if (diff >= 5) return `比上题高 ${diff} 分，稳中有升。`
  if (diff > 0) return `比上题高 ${diff} 分，小步前进。`
  if (diff === 0) return `跟上一题一样 ${thisScore} 分，遇到了天花板，看一下"怎么改"突破它。`
  if (diff >= -5) return `比上题低 ${-diff} 分，小波动，不用慌。`
  if (diff >= -10) return `掉了 ${-diff} 分，这题的点没踩中，回去看硬伤。`
  return `暴跌 ${-diff} 分，这题翻车了，下一题扳回来。`
}

function getWeakestDimension(records: ScoreRecord[]): string {
  if (records.length === 0) return '-'
  const avg = {
    综合分析: records.reduce((s, r) => s + r.analysis, 0) / records.length,
    言语表达: records.reduce((s, r) => s + r.expression, 0) / records.length,
    应急应变: records.reduce((s, r) => s + r.adaptability, 0) / records.length,
    组织管理: records.reduce((s, r) => s + r.organization, 0) / records.length,
  }
  const sorted = Object.entries(avg).sort((a, b) => a[1] - b[1])
  return `${sorted[0][0]}（平均 ${sorted[0][1].toFixed(0)} 分）`
}

const DAILY_LIMIT = 3

export function FullPracticePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, user } = useAuthStore()
  const isPremium = user?.member_type === 'premium'

  const [currentStep, setCurrentStep] = useState<Step>('waiting')
  const [question, setQuestion] = useState<Question | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [scoreResult, setScoreResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [timerKey, setTimerKey] = useState(0)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem('verinx_sound') !== 'off' } catch { return true }
  })

  // 连续答题进度
  const [roundNum, setRoundNum] = useState(1)
  const [scoreHistory, setScoreHistory] = useState<ScoreRecord[]>([])

  // 今日已练次数（本地简单计数，后续移到后端）
  const [todayDone, setTodayDone] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('verinx_daily_count')
      if (!raw) return 0
      const { date, count } = JSON.parse(raw)
      const today = new Date().toISOString().slice(0, 10)
      return date === today ? count : 0
    } catch {
      return 0
    }
  })

  // 小结弹窗
  const [showSummary, setShowSummary] = useState(false)

  // 同步音效开关
  useEffect(() => {
    sfx.setMuted(!soundOn)
    try { localStorage.setItem('verinx_sound', soundOn ? 'on' : 'off') } catch {}
  }, [soundOn])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  // 从薄弱项页面重练：URL 带 content+category 时自动进入思考阶段
  useEffect(() => {
    const content = searchParams.get('content')
    const rawCategory = searchParams.get('category')
    const validCategories: Question['category'][] = ['综合分析', '人际沟通', '应急应变', '组织管理', '自我认知']
    if (content && rawCategory && validCategories.includes(rawCategory as Question['category']) && currentStep === 'waiting') {
      const q: Question = {
        id: 'retry-' + Date.now(),
        content,
        category: rawCategory as Question['category'],
        difficulty: 3,
        answer_reference: '',
        exam_type: '省考',
        created_at: new Date().toISOString(),
      }
      setQuestion(q)
      setCurrentStep('thinking')
      setTimerKey((k) => k + 1)
      navigate('/practice/full', { replace: true })
    }
  }, [searchParams, currentStep, navigate])

  // 写回今日计数
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      localStorage.setItem('verinx_daily_count', JSON.stringify({ date: today, count: todayDone }))
    } catch {}
  }, [todayDone])

  const stepIndex = steps.findIndex((s) => s.key === currentStep)
  const prevScore = useMemo(() => {
    if (scoreHistory.length === 0) return null
    return scoreHistory[scoreHistory.length - 1].overall
  }, [scoreHistory])

  const avgScore = useMemo(() => {
    if (scoreHistory.length === 0) return 0
    return scoreHistory.reduce((s, r) => s + r.overall, 0) / scoreHistory.length
  }, [scoreHistory])

  // 前端限制：仅免费用户受每日3次限制，VIP不限次
  const reachedLimit = !isPremium && todayDone >= DAILY_LIMIT

  const fetchQuestion = async (): Promise<Question | null> => {
    try {
      const res = await api.post('/ai/generate-question', null, {
        params: { random_category: true },
        timeout: 60000,
      })
      const data = res.data.data || res.data
      const q: Question = {
        id: 'ai-generated',
        content: data.content,
        category: data.category || '综合分析',
        difficulty: data.difficulty || 3,
        answer_reference: data.answer_reference || '',
        exam_type: '省考',
        created_at: new Date().toISOString(),
      }
      setQuestion(q)
      return q
    } catch {
      try {
        const res = await api.get('/questions/random')
        const data = res.data.data || res.data
        if (data?.content) {
          setQuestion(data)
          return data
        }
      } catch {
        // 兜底也失败
      }
    }
    return null
  }

  const goNext = () => {
    const idx = stepIndex
    if (idx < steps.length - 1) {
      setCurrentStep(steps[idx + 1].key)
      setTimerKey((k) => k + 1)
    }
  }

  const handleStartMock = async () => {
    if (reachedLimit) return
    sfx.unlock()
    sfx.stepTransition()
    setLoading(true)
    const q = await fetchQuestion()
    setLoading(false)
    if (q) {
      goNext()
    } else {
      setSubmitError('AI出题失败，请稍后重试')
    }
  }

  // 锁定当前题目的快照，防止连续答题时 question 状态被下一题覆盖
  const lockedQuestionRef = useRef<Question | null>(null)

  const handleSubmitAnswer = async () => {
    if (!question) return
    if (!answerText.trim()) {
      setSubmitError('请先输入答案')
      return
    }
    setSubmitError(null)
    sfx.submit()
    setLoading(true)

    // 锁定当前题目快照，评分全程用这个，不受后续 setQuestion 影响
    const lockedQ = { ...question }
    lockedQuestionRef.current = lockedQ
    const mainAnswer = answerText

    setCurrentStep('scoring')
    setTimerKey((k) => k + 1)

    try {
      try {
        await api.post('/practice', {
          question_id: lockedQ.id,
          practice_mode: 'full',
          answer_text: mainAnswer,
        })
      } catch {
        // ignore
      }

      const scoreRes = await api.post('/ai/score', {
        question_content: lockedQ.content,
        answer_text: mainAnswer,
        question_category: lockedQ.category,
      }, { timeout: 120000 })
      const scoreData = scoreRes.data.data || scoreRes.data
      setScoreResult(scoreData)
      sfx.scoreReveal(scoreData.score_overall ?? 0)

      const newRecord: ScoreRecord = {
        overall: scoreData.score_overall ?? 0,
        analysis: scoreData.score_analysis ?? 0,
        expression: scoreData.score_expression ?? 0,
        adaptability: scoreData.score_adaptability ?? 0,
        organization: scoreData.score_organization ?? 0,
        category: lockedQ.category,
      }
      const newHistory = [...scoreHistory, newRecord]
      setScoreHistory(newHistory)
      setTodayDone((n) => n + 1)

      // 每 3 题弹小结
      if (newHistory.length > 0 && newHistory.length % 3 === 0) {
        sfx.summary()
        setShowSummary(true)
      }
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
    } finally {
      setLoading(false)
    }
  }

  const handleThinkingTimeout = () => {
    sfx.stepTransition()
    setCurrentStep('answering')
    setTimerKey((k) => k + 1)
  }

  const handleAnsweringTimeout = () => {
    if (answerText.trim()) {
      handleSubmitAnswer()
    }
  }

  // 连续答题：先获取新题，成功后才切换到思考阶段
  const handleNextRound = async () => {
    if (reachedLimit) return
    setShowSummary(false)
    setLoading(true)
    setAnswerText('')
    setScoreResult(null)
    setSubmitError(null)
    setQuestion(null) // 清空旧题目，避免闪烁显示上一题

    const q = await fetchQuestion()
    setLoading(false)

    if (q) {
      // 新题获取成功，才切换到思考阶段
      sfx.stepTransition()
      setCurrentStep('thinking')
      setTimerKey((k) => k + 1)
      setRoundNum((n) => n + 1)
    } else {
      // 出题失败，回到评分页让用户重试
      setSubmitError('AI出题失败，请稍后重试')
      setScoreResult(null)
      setCurrentStep('scoring')
    }
  }

  const handleReset = () => {
    setCurrentStep('waiting')
    setQuestion(null)
    setAnswerText('')
    setScoreResult(null)
    setLoading(false)
    setTimerKey((k) => k + 1)
    setSubmitError(null)
    setRoundNum(1)
    setScoreHistory([])
    setShowSummary(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* 顶部状态栏：今日进度 + 本轮进度 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.2em] mb-2">
            FULL SIMULATION
          </div>
          <h1 className="font-display text-3xl md:text-4xl tracking-tight">
            全真模拟
          </h1>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-3 mb-1">
            <button
              className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] hover:text-[#F0F0FA] transition-spacex"
              onClick={() => setSoundOn((v) => !v)}
              title={soundOn ? '关闭音效' : '开启音效'}
            >
              {soundOn ? '♪' : '♪̸'}
            </button>
            <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
              {isPremium ? (
                <span>今日 {todayDone} 题 <span className="text-[rgba(255,215,0,0.7)]">VIP 不限次</span></span>
              ) : (
                <>今日 {todayDone} / {DAILY_LIMIT}</>
              )}
            </span>
          </div>
          <div className="text-xs uppercase-spacex tracking-[0.15em] text-[rgba(240,240,250,0.7)]">
            第 {roundNum} 题
            {scoreHistory.length > 0 && (
              <span className="text-[#808080]"> · 均 {avgScore.toFixed(0)}</span>
            )}
          </div>
        </div>
      </div>

      {reachedLimit && (
        <div className="border border-[rgba(239,68,68,0.5)] p-6 mb-8">
          <p className="text-[rgba(240,240,250,0.85)] font-body">
            今天的 3 次免费练习已经用完了。明天再来，或者解锁不限次。
          </p>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={s.key} className="flex-1 flex flex-col items-center">
              <div className={`w-10 h-10 flex items-center justify-center text-xs font-bold border transition-spacex ${
                i < stepIndex
                  ? 'border-[#F0F0FA] bg-[#F0F0FA] text-black'
                  : i === stepIndex
                  ? 'border-[#F0F0FA] bg-transparent text-[#F0F0FA]'
                  : 'border-[rgba(240,240,250,0.35)] text-[#808080]'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </div>
              <span className={`mt-2 text-xs uppercase-spacex tracking-[0.1em] ${
                i <= stepIndex ? 'text-[#F0F0FA]' : 'text-[#808080]'
              }`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s.key}
              className={`flex-1 h-px transition-spacex ${
                i <= stepIndex ? 'bg-[#F0F0FA]' : 'bg-[rgba(240,240,250,0.35)]'
              }`}
            />
          ))}
        </div>
      </div>

      {currentStep !== 'waiting' && currentStep !== 'scoring' && (
        <div className="mt-12">
          <ExamTimer
            key={timerKey}
            mode={currentStep === 'thinking' ? 'thinking' : 'answering'}
            maxSeconds={steps[stepIndex].maxSeconds}
            onTimeout={
              currentStep === 'thinking' ? handleThinkingTimeout :
              handleAnsweringTimeout
            }
            isRunning={true}
          />
        </div>
      )}

      <div className="mt-12">
        {currentStep === 'waiting' && (
          <div className="border border-[rgba(240,240,250,0.35)] p-12 text-center">
            {scoreHistory.length === 0 ? (
              <>
                <p className="text-[rgba(240,240,250,0.7)] font-body">
                  准备好了就开始，一题接着一题，中间不用等。
                </p>
                <p className="mt-3 text-sm text-[#808080]">
                  流程：候考(30s) → 思考(2min) → 答题(4min) → 评分 → 下一题
                </p>
              </>
            ) : (
              <>
                <p className="text-[rgba(240,240,250,0.7)] font-body">
                  你已经练了 {scoreHistory.length} 题，平均分 {avgScore.toFixed(0)}。
                </p>
                <p className="mt-3 text-sm text-[#808080]">
                  想继续就连着答，想重来就重新开始。
                </p>
              </>
            )}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                className="w-full sm:w-auto border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex disabled:opacity-50"
                onClick={handleStartMock}
                disabled={loading || reachedLimit}
              >
                <span className="text-xs uppercase-spacex tracking-[0.15em]">
                  {loading ? 'AI出题中...' : scoreHistory.length === 0 ? '开始模拟' : '继续答题'}
                </span>
              </button>
              {scoreHistory.length > 0 && (
                <button
                  className="w-full sm:w-auto border border-[rgba(240,240,250,0.2)] px-12 py-4 hover:bg-[rgba(240,240,250,0.05)] transition-spacex"
                  onClick={handleReset}
                >
                  <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
                    重新开始
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {currentStep === 'thinking' && question && (
          <div className="space-y-8">
            <QuestionCard question={question} />
            <p className="text-sm text-[#808080] text-center">请在规定时间内思考，准备好后点击"开始答题"</p>
            <div className="text-center">
              <button
                className="border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex"
                onClick={() => { sfx.stepTransition(); setCurrentStep('answering'); setTimerKey((k) => k + 1) }}
              >
                <span className="text-xs uppercase-spacex tracking-[0.15em]">
                  开始答题
                </span>
              </button>
            </div>
          </div>
        )}

        {currentStep === 'answering' && (
          <div className="space-y-8">
            {question && (
              <div className="border border-[rgba(240,240,250,0.35)] p-8">
                <p className="text-[rgba(240,240,250,0.9)] font-body leading-relaxed">{question.content}</p>
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
              className="w-full border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex disabled:opacity-50"
              onClick={handleSubmitAnswer}
              disabled={loading}
            >
              <span className="text-xs uppercase-spacex tracking-[0.15em]">
                {loading ? 'AI评分中...' : '提交答案'}
              </span>
            </button>
          </div>
        )}

        {currentStep === 'scoring' && !scoreResult && (
          <div className="border border-[rgba(240,240,250,0.35)] p-16 text-center">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-3 h-3 bg-[#F0F0FA] animate-pulse" />
              <div className="w-3 h-3 bg-[rgba(240,240,250,0.5)] animate-pulse" style={{ animationDelay: '0.2s' }} />
              <div className="w-3 h-3 bg-[rgba(240,240,250,0.3)] animate-pulse" style={{ animationDelay: '0.4s' }} />
            </div>
            <p className="font-display text-xl tracking-tight">VERINX 正在分析你的回答</p>
            <p className="mt-3 text-sm text-[#808080]">
              从四个维度逐句拆解，稍等几秒...
            </p>
          </div>
        )}

        {currentStep === 'scoring' && scoreResult && (
          <div className="space-y-8">
            {/* VERINX 个性化总评 */}
            <div className="border border-[rgba(240,240,250,0.35)] p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 bg-[#F0F0FA] animate-pulse" />
                <span className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080]">
                  VERINX SAYS
                </span>
              </div>
              <p className="text-[rgba(240,240,250,0.9)] font-body leading-relaxed">
                {getVerinxComment(scoreResult.score_overall ?? 0, prevScore, roundNum)}
              </p>
            </div>

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
              answerReference={lockedQuestionRef.current?.answer_reference ?? undefined}
            />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                className="w-full sm:w-auto border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex disabled:opacity-50"
                onClick={handleNextRound}
                disabled={reachedLimit}
              >
                <span className="text-xs uppercase-spacex tracking-[0.15em]">
                  {reachedLimit ? '今日次数已用完' : '下一题 →'}
                </span>
              </button>
              <Link
                to="/weakness"
                className="w-full sm:w-auto border border-[rgba(240,240,250,0.2)] px-12 py-4 hover:bg-[rgba(240,240,250,0.05)] transition-spacex text-center"
              >
                <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
                  查看薄弱项
                </span>
              </Link>
              <button
                className="w-full sm:w-auto border border-[rgba(240,240,250,0.2)] px-12 py-4 hover:bg-[rgba(240,240,250,0.05)] transition-spacex"
                onClick={handleReset}
              >
                <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
                  结束本轮
                </span>
              </button>
            </div>

            <div className="mt-8">
              <DisclaimerBanner />
            </div>
          </div>
        )}
      </div>

      {/* 每 3 题小结弹窗 */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6" onClick={() => setShowSummary(false)}>
          <div
            className="border border-[rgba(240,240,250,0.35)] bg-[#0a0a0a] max-w-md w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080] mb-6">
              {scoreHistory.length} 题小结
            </div>
            <h2 className="font-display text-2xl tracking-tight mb-8">
              这 {scoreHistory.length} 题感觉怎么样？
            </h2>

            <div className="space-y-6">
              <div>
                <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">平均分</div>
                <div className="text-5xl font-bold tabular-nums text-[#F0F0FA]">
                  {avgScore.toFixed(0)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">最高分</div>
                <div className="text-3xl font-bold tabular-nums text-[rgba(240,240,250,0.8)]">
                  {Math.max(...scoreHistory.map((r) => r.overall))}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">最弱项</div>
                <div className="text-lg text-[rgba(240,240,250,0.85)] font-body">
                  {getWeakestDimension(scoreHistory)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">VERINX 说</div>
                <p className="text-[rgba(240,240,250,0.85)] font-body leading-relaxed">
                  {avgScore >= 80
                    ? `${scoreHistory.length} 题都在 80 左右，状态稳了。保持这个节奏，考试不会慌。`
                    : avgScore >= 70
                    ? `平均分 70+，已经脱离危险区，但离"稳了"还差 10 分。重点盯紧"${getWeakestDimension(scoreHistory).split('（')[0]}"。`
                    : `还在及格线附近徘徊，别贪多。回头每题把"硬伤"和"怎么改"都过一遍，再刷下一轮。`}
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
              <button
                className="w-full border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex disabled:opacity-50"
                onClick={handleNextRound}
                disabled={reachedLimit}
              >
                <span className="text-xs uppercase-spacex tracking-[0.15em]">
                  {reachedLimit ? '今日次数已用完' : '继续刷'}
                </span>
              </button>
              <button
                className="w-full border border-[rgba(240,240,250,0.2)] px-12 py-4 hover:bg-[rgba(240,240,250,0.05)] transition-spacex"
                onClick={() => { setShowSummary(false); handleReset() }}
              >
                <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
                  先歇了
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
