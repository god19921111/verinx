import { useState, useEffect, useRef, useCallback } from 'react'
import { sfx } from '@/lib/sfx'

interface ExamTimerProps {
  mode: 'thinking' | 'answering'
  maxSeconds: number
  onTimeout: () => void
  isRunning: boolean
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getTimerColor(remaining: number, max: number): string {
  if (remaining <= 10) return 'text-[rgba(239,68,68,0.9)]'
  if (remaining <= 30) return 'text-[rgba(245,158,11,0.9)]'
  return 'text-[#F0F0FA]'
}

function getBarColor(remaining: number, max: number): string {
  if (remaining <= 10) return 'bg-[rgba(239,68,68,0.9)]'
  if (remaining <= 30) return 'bg-[rgba(245,158,11,0.9)]'
  return 'bg-[#F0F0FA]'
}

export function ExamTimer({ mode, maxSeconds, onTimeout, isRunning }: ExamTimerProps) {
  const [remaining, setRemaining] = useState(maxSeconds)
  const timeoutCalled = useRef(false)

  const handleTimeout = useCallback(() => {
    if (!timeoutCalled.current) {
      timeoutCalled.current = true
      onTimeout()
    }
  }, [onTimeout])

  useEffect(() => {
    setRemaining(maxSeconds)
    timeoutCalled.current = false
  }, [maxSeconds])

  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          sfx.timeUp()
          handleTimeout()
          return 0
        }
        // 最后10秒滴答
        if (prev <= 10) {
          if (prev <= 3) {
            sfx.tickUrgent()
          } else {
            sfx.tick()
          }
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, handleTimeout])

  const progress = remaining / maxSeconds
  const modeLabel = mode === 'thinking' ? 'THINKING TIME' : 'ANSWERING TIME'

  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
          {modeLabel}
        </span>
        <span
          className={`text-3xl font-bold font-mono tabular-nums transition-spacex ${
            getTimerColor(remaining, maxSeconds)
          }`}
        >
          {formatTime(remaining)}
        </span>
      </div>
      <div className="h-1 w-full bg-[rgba(240,240,250,0.1)]">
        <div
          className={`h-full transition-all duration-1000 ${
            getBarColor(remaining, maxSeconds)
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}
