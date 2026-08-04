import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '@/lib/api'
import type { Question } from '@/types'
import { BouncyButton } from '@/components/BouncyButton'
import { QuestionCard } from '@/components/QuestionCard'
import { ScoreCard } from '@/components/ScoreCard'
import { DisclaimerBanner } from '@/components/DisclaimerBanner'
import { ComboEffect, WrongFlash, CorrectPulse, AnswerFeedback } from '@/components/Gamification'
import { playSound } from '@/lib/sound'
import { sfx } from '@/lib/sfx'

type Step = 'home' | 'thinking' | 'answering' | 'scoring' | 'result'

const TIME_PRESSURE_CONFIG = {
  thinkingSeconds: 30,
  answeringSeconds: 120,
}

export function ChallengePage() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()

  const [step, setStep] = useState<Step>('home')
  const [question, setQuestion] = useState<Question | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [scoreResult, setScoreResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TIME_PRESSURE_CONFIG.thinkingSeconds)
  const [highScore, setHighScore] = useState(0)
  const [attemptCount, setAttemptCount] = useState(0)
  const [pulseKey, setPulseKey] = useState(0)
  const lastTickRef = useRef<number>(0)

  // 激励系统状态
  const [combo, setCombo] = useState(0)
  const [feedbackTrigger, setFeedbackTrigger] = useState<'correct' | 'wrong' | null>(null)
  const [feedbackKey, setFeedbackKey] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const [pulseCorrectKey, setPulseCorrectKey] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    const stored = localStorage.getItem('verinx_challenge_highscore')
    if (stored) setHighScore(parseFloat(stored))
    const countStored = localStorage.getItem('verinx_challenge_attempts')
    if (countStored) setAttemptCount(parseInt(countStored))
  }, [isAuthenticated, navigate])

  useEffect(() => {
    if (step !== 'thinking' && step !== 'answering') return
    if (timeLeft <= 0) {
      if (step === 'thinking') {
        setStep('answering')
        setTimeLeft(TIME_PRESSURE_CONFIG.answeringSeconds)
        sfx.timeUp()
      } else {
        handleSubmitAnswer()
      }
      return
    }
    // 每秒滴答音效（最后10秒更急促）
    if (timeLeft <= 10 && timeLeft > 0) {
      sfx.tickUrgent()
    } else if (timeLeft <= 30 && timeLeft > 0) {
      sfx.tick()
    }
    setPulseKey(k => k + 1)
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(timer)
  }, [step, timeLeft])

  const startChallenge = async () => {
    setLoading(true)
    setAnswerText('')
    setScoreResult(null)
    // 直接进入倒计时，题目异步加载
    setStep('thinking')
    setTimeLeft(TIME_PRESSURE_CONFIG.thinkingSeconds)
    playSound('challenge')

    try {
      const res = await api.get('/questions/random')
      const data = res.data.data || res.data
      if (data?.content) {
        setQuestion(data as Question)
      } else {
        throw new Error('没有题目')
      }
    } catch {
      try {
        const res = await api.post('/ai/generate-question', null, {
          params: { random_category: true },
          timeout: 60000,
        })
        const data = res.data.data || res.data
        setQuestion({
          id: 'challenge-generated',
          content: data.content,
          category: data.category || '综合分析',
          difficulty: (data.difficulty || 3) + 1,
          answer_reference: data.answer_reference || '',
          exam_type: '省考',
          created_at: new Date().toISOString(),
        })
      } catch {
        // 兜底默认题
        setQuestion({
          id: 'challenge-default',
          content: '请谈谈你对"压力之下方见真章"这句话的理解，并结合自身经历说明。',
          category: '综合分析',
          difficulty: 4,
          answer_reference: '',
          exam_type: '国考',
          created_at: new Date().toISOString(),
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const beginAnswering = () => {
    setStep('answering')
    setTimeLeft(TIME_PRESSURE_CONFIG.answeringSeconds)
    sfx.stepTransition()
  }

  const handleSubmitAnswer = async () => {
    if (!question) return
    setLoading(true)
    setStep('scoring')

    try {
      try {
        await api.post('/practice', {
          question_id: question.id,
          practice_mode: 'challenge',
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

      const score = scoreData.score_overall ?? 0

      // ── 触发激励反馈 ──
      const isCorrect = score >= 70
      if (isCorrect) {
        const newCombo = combo + 1
        setCombo(newCombo)
        setFeedbackTrigger('correct')
        setFeedbackKey(Date.now())
        setPulseCorrectKey(Date.now())
        if (newCombo >= 3) playSound('success')
      } else {
        setCombo(0)
        setFeedbackTrigger('wrong')
        setFeedbackKey(Date.now())
        setFlashKey(Date.now())
        playSound('fail')
      }

      const newAttempts = attemptCount + 1
      setAttemptCount(newAttempts)
      localStorage.setItem('verinx_challenge_attempts', String(newAttempts))

      if (score > highScore) {
        setHighScore(score)
        localStorage.setItem('verinx_challenge_highscore', String(score))
      }

      setStep('result')
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
      setStep('result')
    } finally {
      setLoading(false)
    }
  }

  const resetChallenge = () => {
    setStep('home')
    setQuestion(null)
    setAnswerText('')
    setScoreResult(null)
    setCombo(0)
    setFeedbackTrigger(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8" style={{ animation: 'fadeInDown 600ms ease-out both' }}>
        <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.2em] mb-2">
          PRESSURE TRAINING
        </div>
        <h1 className="font-display text-3xl tracking-tight">极限挑战</h1>
        <p className="mt-2 text-sm text-[rgba(240,240,250,0.6)] font-body">
          压力下的表现才是真实的水平。时间更短，难度更高。
        </p>
      </div>

      {step === 'home' && (
        <div className="space-y-6">
          <div
            className="group relative border border-[rgba(34,211,238,0.08)] p-10 text-center overflow-hidden hover:border-[rgba(34,211,238,0.25)] transition-spacex"
            style={{ animation: 'fadeInUp 700ms ease-out 100ms both' }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.05) 0%, transparent 70%)' }}
            />
            <div className="relative z-10">
              <div className="text-[11px] uppercase-spacex tracking-[0.2em] text-[#808080] mb-3">
                最高分
              </div>
              <div
                className="font-display tabular-nums text-[#F0F0FA] leading-none group-hover:scale-105 transition-transform duration-500"
                style={{ fontSize: '96px', textShadow: '0 0 30px rgba(34,211,238,0.12)' }}
              >
                {highScore || '--'}
              </div>
              {attemptCount > 0 && (
                <div className="mt-4 text-[10px] uppercase-spacex tracking-[0.2em] text-[#808080]">
                  已挑战 {attemptCount} 次
                </div>
              )}
            </div>
          </div>

          <div
            className="text-center"
            style={{ animation: 'fadeInUp 700ms ease-out 300ms both' }}
          >
            <BouncyButton
              className="border border-[rgba(34,211,238,0.5)] px-16 py-5 hover:bg-[rgba(34,211,238,0.08)] transition-spacex disabled:opacity-50"
              onClick={startChallenge}
              disabled={loading}
              pop={2}
              particles
              sound="challenge"
            >
              <span className="text-xs uppercase-spacex tracking-[0.15em]">
                {loading ? '准备中...' : '开始极限挑战 →'}
              </span>
            </BouncyButton>
          </div>

          <p
            className="text-center text-xs text-[rgba(240,240,250,0.4)] font-body"
            style={{ animation: 'fadeInUp 700ms ease-out 500ms both' }}
          >
            挑战不限次数，尽情刷榜
          </p>
        </div>
      )}

      {(step === 'thinking' || step === 'answering') && (
        <div className="space-y-6" style={{ animation: 'fadeInUp 500ms ease-out both' }}>
          {/* 倒计时 */}
          <div
            className="border border-[rgba(34,211,238,0.35)] p-6 text-center relative overflow-hidden"
            style={{
              boxShadow: timeLeft <= 10 ? '0 0 24px rgba(34,211,238,0.15)' : 'none',
              transition: 'box-shadow 300ms ease',
            }}
          >
            <div className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080] mb-3">
              {step === 'thinking' ? 'THINKING' : 'ANSWERING'}
            </div>
            <div
              key={pulseKey}
              className="font-display text-7xl tabular-nums text-[#F0F0FA] leading-none"
              style={{
                animation: timeLeft <= 10 ? 'urgentPulse 500ms ease-out' : 'softPulse 1000ms ease-out',
                color: timeLeft <= 10 ? '#22d3ee' : '#F0F0FA',
              }}
            >
              {timeLeft}
            </div>
            <div className="text-[10px] text-[#808080] mt-3 uppercase-spacex tracking-[0.15em]">
              {step === 'thinking' ? '思考倒计时 · 结束自动进入答题' : '答题倒计时 · 结束自动提交'}
            </div>
            {loading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#22d3ee] animate-pulse" />
                  <div className="w-2 h-2 bg-[#22d3ee] animate-pulse" style={{ animationDelay: '0.15s' }} />
                  <div className="w-2 h-2 bg-[#22d3ee] animate-pulse" style={{ animationDelay: '0.3s' }} />
                </div>
              </div>
            )}
          </div>

          {question ? (
            <div
              className="border border-[rgba(240,240,250,0.12)] p-6 hover:border-[rgba(240,240,250,0.2)] transition-spacex"
              style={{ animation: 'fadeInUp 600ms ease-out 200ms both' }}
            >
              <p className="text-[rgba(240,240,250,0.9)] font-body leading-relaxed text-lg">
                {question.content}
              </p>
            </div>
          ) : (
            <div className="border border-[rgba(240,240,250,0.08)] p-12 flex items-center justify-center">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-[#22d3ee] animate-pulse" />
                <div className="w-2 h-2 bg-[#22d3ee] animate-pulse" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 bg-[#22d3ee] animate-pulse" style={{ animationDelay: '0.3s' }} />
                <span className="text-xs text-[#808080] uppercase-spacex tracking-[0.15em] ml-2">
                  加载题目
                </span>
              </div>
            </div>
          )}

          {step === 'answering' && (
            <>
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="快速组织你的答案..."
                rows={8}
                className="w-full border border-[rgba(240,240,250,0.15)] bg-transparent px-4 py-4 text-[#F0F0FA] font-body placeholder:text-[#808080] focus:border-[rgba(34,211,238,0.6)] focus:outline-none resize-none transition-spacex"
                style={{ animation: 'fadeInUp 500ms ease-out 100ms both' }}
              />
              <BouncyButton
                className="w-full border border-[rgba(34,211,238,0.5)] px-12 py-4 hover:bg-[rgba(34,211,238,0.08)] transition-spacex"
                onClick={handleSubmitAnswer}
                disabled={loading}
                pop={1}
                sound="click"
              >
                <span className="text-xs uppercase-spacex tracking-[0.15em]">
                  {loading ? '评分中...' : '提交答案'}
                </span>
              </BouncyButton>
            </>
          )}

          {step === 'thinking' && (
            <button
              className="group w-full border border-[rgba(240,240,250,0.12)] px-12 py-4 hover:bg-[rgba(240,240,250,0.04)] hover:border-[rgba(240,240,250,0.25)] transition-spacex relative overflow-hidden"
              onClick={beginAnswering}
            >
              <span className="relative z-10 text-xs uppercase-spacex tracking-[0.15em] text-[#808080] group-hover:text-[#F0F0FA] transition-spacex">
                提前进入答题 →
              </span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(240,240,250,0.04), transparent)' }}
              />
            </button>
          )}
        </div>
      )}

      {step === 'scoring' && (
        <div
          className="border border-[rgba(240,240,250,0.35)] p-16 text-center"
          style={{ animation: 'fadeInUp 500ms ease-out both' }}
        >
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-3 h-3 bg-[#F0F0FA] animate-pulse" />
            <div className="w-3 h-3 bg-[rgba(240,240,250,0.5)] animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-3 h-3 bg-[rgba(240,240,250,0.3)] animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <p className="font-display text-xl tracking-tight">VERINX 正在极限评分</p>
        </div>
      )}

      {step === 'result' && scoreResult && (
        <div className="space-y-6" style={{ animation: 'fadeInUp 600ms ease-out both' }}>
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

          {scoreResult.score_overall >= highScore && highScore > 0 && (
            <div
              className="border border-[rgba(34,211,238,0.4)] p-4 text-center"
              style={{ animation: 'fadeInUp 400ms ease-out' }}
            >
              <span className="text-xs uppercase-spacex tracking-[0.2em] text-[#22d3ee]">
                ◉ 新纪录 · 最高分 {highScore}
              </span>
            </div>
          )}

          {/* 激励效果浮层 */}
          <ComboEffect combo={combo} trigger={feedbackTrigger} triggerKey={feedbackKey} />
          <WrongFlash triggerKey={flashKey} />
          <CorrectPulse triggerKey={pulseCorrectKey} />
          <AnswerFeedback
            type={feedbackTrigger}
            score={scoreResult.score_overall}
            combo={combo}
            triggerKey={feedbackKey}
          />

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <BouncyButton
              onClick={startChallenge}
              className="w-full sm:w-auto border border-[rgba(34,211,238,0.5)] px-12 py-4 hover:bg-[rgba(34,211,238,0.08)] transition-spacex"
              pop={1}
              sound="challenge"
              particles
            >
              <span className="text-xs uppercase-spacex tracking-[0.15em]">
                再来一轮
              </span>
            </BouncyButton>
            <button
              onClick={resetChallenge}
              className="w-full sm:w-auto border border-[rgba(240,240,250,0.12)] px-12 py-4 hover:bg-[rgba(240,240,250,0.04)] hover:border-[rgba(240,240,250,0.25)] transition-spacex"
            >
              <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
                返回首页
              </span>
            </button>
          </div>

          <DisclaimerBanner />
        </div>
      )}

      <style>{`
        @keyframes softPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.03); opacity: 0.85; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes urgentPulse {
          0% { transform: scale(1); }
          25% { transform: scale(1.08); }
          50% { transform: scale(1); }
          75% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          0% { opacity: 0; transform: translateY(-12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
