import React, { useEffect, useRef, useState, useCallback, Children, cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement } from 'react'
import clsx from 'clsx'
import { playSound, type SoundName } from '@/lib/sound'

export interface BouncyButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'ref'> {
  /** 按钮点击时播放的音效（默认 'click'，传 null 静音） */
  sound?: SoundName | null
  /** 成功/打卡时使用的提示类型（播放对应音效 success/checkin/challenge/score） */
  feedbackOnSuccess?: SoundName | null
  /** 按压回弹强度，1=标准，2=激烈，0=仅缩放 */
  pop?: 0 | 1 | 2
  /** 是否开启粒子效果（打卡/挑战用 */
  particles?: boolean
  /** 用于替换 className（点击时是否加上动画类名） */
  asChild?: boolean
  /** 作为子元素渲染器（传入自定义元素 / 自定义颜色） */
  variant?: 'solid' | 'outline' | 'ghost'
}

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  life: number
  lifeMax: number
}

const COLORS = [
  '#22d3ee',
  '#818cf8',
  '#a78bfa',
  '#c084fc',
  '#34d399',
  '#60a5fa',
  '#f0f0fa',
]

export const BouncyButton = React.forwardRef<HTMLButtonElement, BouncyButtonProps>(
  (
    {
      sound = 'click',
      feedbackOnSuccess = null,
      pop = 1,
      particles = false,
      className,
      onClick,
      children,
      style,
      ...rest
    },
    ref,
  ) => {
    const [pressed, setPressed] = useState(false)
    const [burstKey, setBurstKey] = useState(0)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const clickLock = useRef(false)

    const handleClick = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (clickLock.current) return
        if (sound) playSound(sound)

        setPressed(true)
        window.setTimeout(() => setPressed(false), pop === 0 ? 150 : 280)

        if (particles) {
          setBurstKey(k => k + 1)
        }

        const res = onClick?.(e)
        if (res && typeof (res as any).then === 'function') {
          clickLock.current = true
          try {
            await res
            if (feedbackOnSuccess) playSound(feedbackOnSuccess)
          } catch {
            playSound('fail')
          } finally {
            clickLock.current = false
          }
        } else if (feedbackOnSuccess) {
          playSound(feedbackOnSuccess)
        }
      },
      [onClick, pop, sound, particles, feedbackOnSuccess],
    )

    // 按压态类名（多邻国风格：按下时向下位移+轻度缩放；松开时回弹+向上弹跳）
    const popStyle = (): React.CSSProperties => {
      if (pop === 0) {
        return {
          transition: 'transform 120ms ease-out',
          transform: pressed ? 'scale(0.97)' : 'scale(1)',
        }
      }
      if (pop === 2) {
        return {
          transition: pressed
            ? 'transform 70ms cubic-bezier(0.2,1,0.4,1), box-shadow 150ms ease-out'
            : 'transform 380ms cubic-bezier(0.175,0.885,0.32,1.275), box-shadow 280ms ease-out',
          transform: pressed ? 'translateY(3px) scale(0.955)' : 'translateY(0) scale(1)',
        }
      }
      return {
        transition: pressed
          ? 'transform 90ms ease-out'
          : 'transform 320ms cubic-bezier(0.175,0.885,0.32,1.275)',
        transform: pressed ? 'translateY(2px) scale(0.975)' : 'translateY(0) scale(1)',
      }
    }

    return (
      <div
        ref={containerRef}
        className="relative inline-flex"
        style={{ perspective: 600 }}
      >
        <button
          ref={ref}
          onClick={handleClick}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          onTouchStart={() => setPressed(true)}
          onTouchEnd={() => setPressed(false)}
          className={clsx(
            'select-none will-change-transform',
            'focus:outline-none focus-visible:ring-0',
            className,
          )}
          style={{ ...popStyle(), ...style }}
          {...rest}
        >
          {children}
        </button>
        {particles && burstKey > 0 && (
          <BurstParticles key={burstKey} containerRef={containerRef} />
        )}
      </div>
    )
  },
)

BouncyButton.displayName = 'BouncyButton'

function BurstParticles({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [particles, setParticles] = useState<Particle[]>([])
  const idRef = useRef(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const count = 16
    const init: Particle[] = Array.from({ length: count }).map(() => {
      const angle = Math.random() * Math.PI * 2
      const speed = 1 + Math.random() * 3
      return {
        id: ++idRef.current,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 3 + Math.random() * 4,
        life: 1,
        lifeMax: 0.6 + Math.random() * 0.4,
      }
    })
    setParticles(init)

    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      setParticles(prev => {
        if (prev.length === 0) return prev
        return prev
          .map(p => ({
            ...p,
            x: p.x + p.vx * 60 * dt,
            y: p.y + p.vy * 60 * dt,
            vy: p.vy + 6 * dt,
            life: Math.max(0, p.life - dt / p.lifeMax),
          }))
          .filter(p => p.life > 0)
      })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [containerRef])

  if (particles.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-visible"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    >
      {particles.map(p => (
        <span
          key={p.id}
          style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${p.x}px, ${p.y}px)`,
          width: p.size,
          height: p.size,
          borderRadius: 999,
          backgroundColor: p.color,
          opacity: p.life,
          boxShadow: `0 0 6px ${p.color}`,
        }}
        />
      ))}
    </div>
  )
}

/** 可直接包裹现有的任意元素/Link等 */
export function BouncyWrap({
  children,
  onClick,
  sound = 'click',
  pop = 1,
  feedbackOnSuccess = null,
  particles = false,
  className,
}: {
  children: ReactElement
  onClick?: (e: React.MouseEvent<any>) => void | Promise<void>
  sound?: SoundName | null
  pop?: 0 | 1 | 2
  feedbackOnSuccess?: SoundName | null
  particles?: boolean
  className?: string
}) {
  const child = children
  const [pressed, setPressed] = useState(false)
  const handleClick = async (e: React.MouseEvent<any>) => {
    if (sound) playSound(sound)
    setPressed(true)
    window.setTimeout(() => setPressed(false), 260)
    const r = onClick?.(e)
    if (r && typeof (r as any).then === 'function') {
      try {
        await r
        if (feedbackOnSuccess) playSound(feedbackOnSuccess)
      } catch {
        playSound('fail')
      }
    } else if (feedbackOnSuccess) {
      playSound(feedbackOnSuccess)
    }
  }

  if (!isValidElement(child)) return <>{child}</>
  const popStyle: React.CSSProperties = {
    transition: pressed
      ? 'transform 90ms ease-out'
      : 'transform 320ms cubic-bezier(0.175,0.885,0.32,1.275)',
    transform: pressed
      ? pop === 0 ? 'scale(0.97)' : 'translateY(2px) scale(0.975)'
      : 'translateY(0) scale(1)',
  }

  return cloneElement(child as ReactElement<any>, {
    onClick: handleClick,
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
    onMouseLeave: () => setPressed(false),
    onTouchStart: () => setPressed(true),
    onTouchEnd: () => setPressed(false),
    className: clsx(
      'select-none will-change-transform',
      className,
      (child.props as any).className,
    ),
    style: {
      ...popStyle,
      ...((child.props as any).style || {}),
    },
  })
}
