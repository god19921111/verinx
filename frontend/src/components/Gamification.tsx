import { useEffect, useRef, useState } from 'react'

// ════════════════════════════════════════════════════════════════════════════
// 1. 连胜展示 StreakDisplay
// ════════════════════════════════════════════════════════════════════════════

interface StreakDisplayProps {
  streakDays: number
  maxStreakDays: number
}

export function StreakDisplay({ streakDays, maxStreakDays }: StreakDisplayProps) {
  return (
    <div className="rounded-2xl border border-[rgba(100,120,200,0.15)] bg-[rgba(15,20,40,0.6)] backdrop-blur-md p-5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-[rgba(180,200,255,0.5)] uppercase mb-1">COSMIC LOG</div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-light text-white tabular-nums">{streakDays}</span>
            <span className="text-sm text-[rgba(180,200,255,0.6)]">天连续航行</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[rgba(180,200,255,0.4)] uppercase tracking-widest">最佳记录</div>
          <div className="text-lg text-[#22d3ee] font-light tabular-nums">{maxStreakDays} 天</div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 2. 连击效果 ComboEffect（浮动数字 + 屏幕震动）
// ════════════════════════════════════════════════════════════════════════════

interface ComboEffectProps {
  /** 当前连击数 */
  combo: number
  /** 是否答对（触发上升动画） */
  trigger: 'correct' | 'wrong' | null
  /** 触发时间戳，用于重新动画 */
  triggerKey: number
}

export function ComboEffect({ combo, trigger, triggerKey }: ComboEffectProps) {
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; emoji: string }[]>([])
  const [shake, setShake] = useState(false)
  const prevTriggerKey = useRef(0)

  useEffect(() => {
    if (triggerKey === prevTriggerKey.current) return
    prevTriggerKey.current = triggerKey
    if (!trigger) return

    if (trigger === 'correct' && combo > 0) {
      // 生成上升粒子
      const newParticles = Array.from({ length: Math.min(combo, 8) }, (_, i) => ({
        id: triggerKey * 100 + i,
        x: 50 + (Math.random() - 0.5) * 60,
        y: 50 + (Math.random() - 0.5) * 40,
        emoji: ['✦', '⚡', '◈', '◉'][i % 4],
      }))
      setParticles(newParticles)
      setTimeout(() => setParticles([]), 1200)
    }

    if (trigger === 'wrong') {
      setShake(true)
      setTimeout(() => setShake(false), 400)
    }
  }, [triggerKey, trigger, combo])

  return (
    <>
      {/* 屏幕震动容器（由父组件包装） */}
      {shake && (
        <style>{`
          @keyframes comboShake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px) rotate(-0.3deg); }
            40% { transform: translateX(8px) rotate(0.3deg); }
            60% { transform: translateX(-5px); }
            80% { transform: translateX(5px); }
          }
        `}</style>
      )}

      {/* 浮动连击数字 */}
      {combo >= 2 && trigger === 'correct' && (
        <div
          key={triggerKey}
          className="fixed pointer-events-none"
          style={{
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 60,
            animation: 'comboFloat 1.2s ease-out forwards',
          }}
        >
          <div
            className="text-center"
            style={{
              fontSize: `${Math.min(48 + combo * 4, 80)}px`,
              fontWeight: 200,
              color: combo >= 10 ? '#fbbf24' : combo >= 5 ? '#22d3ee' : '#818cf8',
              textShadow: `0 0 ${20 + combo * 2}px ${combo >= 10 ? 'rgba(251,191,36,0.6)' : combo >= 5 ? 'rgba(34,211,238,0.5)' : 'rgba(129,140,248,0.4)'}`,
              lineHeight: 1,
            }}
          >
            {combo}
          </div>
          <div
            className="text-center text-xs tracking-[0.3em] uppercase mt-1"
            style={{ color: combo >= 10 ? '#fbbf24' : '#22d3ee' }}
          >
            {combo >= 10 ? 'ENGINE OVERLOAD' : combo >= 5 ? 'COMBO STREAK' : 'COMBO'}
          </div>
        </div>
      )}

      {/* 上升粒子 */}
      {particles.map(p => (
        <div
          key={p.id}
          className="fixed pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            zIndex: 55,
            fontSize: '20px',
            color: '#22d3ee',
            animation: 'particleRise 1.2s ease-out forwards',
          }}
        >
          {p.emoji}
        </div>
      ))}

      <style>{`
        @keyframes comboFloat {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          20% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
          40% { transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -80%) scale(0.9); }
        }
        @keyframes particleRise {
          0% { opacity: 0; transform: translateY(0) scale(0.5); }
          30% { opacity: 1; transform: translateY(-20px) scale(1); }
          100% { opacity: 0; transform: translateY(-80px) scale(0.8); }
        }
      `}</style>
    </>
  )
}

/** 答错时的全屏红色闪光 */
export function WrongFlash({ triggerKey }: { triggerKey: number }) {
  const [show, setShow] = useState(false)
  const prev = useRef(0)
  useEffect(() => {
    if (triggerKey === prev.current) return
    prev.current = triggerKey
    if (triggerKey === 0) return
    setShow(true)
    setTimeout(() => setShow(false), 500)
  }, [triggerKey])

  if (!show) return null
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 50,
        background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.15) 0%, transparent 70%)',
        animation: 'wrongFlash 0.5s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes wrongFlash {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

/** 答对时的全屏青色脉冲 */
export function CorrectPulse({ triggerKey }: { triggerKey: number }) {
  const [show, setShow] = useState(false)
  const prev = useRef(0)
  useEffect(() => {
    if (triggerKey === prev.current) return
    prev.current = triggerKey
    if (triggerKey === 0) return
    setShow(true)
    setTimeout(() => setShow(false), 600)
  }, [triggerKey])

  if (!show) return null
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 50,
        background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.08) 0%, transparent 60%)',
        animation: 'correctPulse 0.6s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes correctPulse {
          0% { opacity: 0; transform: scale(0.95); }
          30% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// 3. 答题正确/错误的即时反馈横幅 AnswerFeedback
// ════════════════════════════════════════════════════════════════════════════

interface AnswerFeedbackProps {
  type: 'correct' | 'wrong' | null
  score?: number
  combo?: number
  triggerKey: number
}

export function AnswerFeedback({ type, score, combo, triggerKey }: AnswerFeedbackProps) {
  const [show, setShow] = useState(false)
  const prev = useRef(0)

  useEffect(() => {
    if (triggerKey === prev.current) return
    prev.current = triggerKey
    if (!type || triggerKey === 0) return
    setShow(true)
    setTimeout(() => setShow(false), 2000)
  }, [triggerKey, type])

  if (!show || !type) return null

  const isCorrect = type === 'correct'

  return (
    <div
      className="fixed top-1/2 left-1/2 pointer-events-none z-[65]"
      style={{
        transform: 'translate(-50%, -50%)',
        animation: 'feedbackPop 2s ease-out forwards',
      }}
    >
      <div className="text-center">
        <div
          className="text-6xl font-light mb-2"
          style={{
            color: isCorrect ? '#22d3ee' : '#ef4444',
            textShadow: `0 0 30px ${isCorrect ? 'rgba(34,211,238,0.5)' : 'rgba(239,68,68,0.4)'}`,
          }}
        >
          {isCorrect ? '✦' : '✕'}
        </div>
        <div
          className="text-sm tracking-[0.3em] uppercase font-medium"
          style={{ color: isCorrect ? '#22d3ee' : '#ef4444' }}
        >
          {isCorrect ? (combo && combo >= 5 ? 'PERFECT COMBO' : 'CORRECT') : 'TRY AGAIN'}
        </div>
        {score != null && (
          <div className="text-2xl font-light text-white mt-1 tabular-nums">
            +{Math.round(score)}
          </div>
        )}
      </div>

      <style>{`
        @keyframes feedbackPop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
          15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          25% { transform: translate(-50%, -50%) scale(1); }
          80% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -70%) scale(0.95); }
        }
      `}</style>
    </div>
  )
}
