import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '@/lib/api'
import type { CheckinStatus } from '@/types'
import { playSound } from '@/lib/sound'
import { StreakDisplay } from '@/components/Gamification'

// ── Planet image cache ──────────────────────────────────────────────────────
const planetImages: Record<string, HTMLImageElement> = {}
const planetImagePaths: Record<string, string> = {
  sun: '/planets/sun.jpg',
  moon: '/planets/moon.jpg',
  earth: '/planets/earth.jpg',
  mars: '/planets/mars.jpg',
  jupiter: '/planets/jupiter.jpg',
  saturn: '/planets/saturn.jpg',
}

function preloadPlanetImages(): Promise<void> {
  return new Promise((resolve) => {
    const keys = Object.keys(planetImagePaths)
    let loaded = 0
    keys.forEach((key) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        planetImages[key] = img
        loaded++
        if (loaded === keys.length) resolve()
      }
      img.onerror = () => {
        loaded++
        if (loaded === keys.length) resolve()
      }
      img.src = planetImagePaths[key]
    })
  })
}

// ── Interstellar Space Voyage with Real Planet Images ────────────────────────
interface Star3D {
  x: number; y: number; z: number;
  baseSize: number; // 基础尺寸
  twinkleSpeed: number; // 闪烁速度
  twinklePhase: number; // 闪烁相位
  // B-V 颜色索引：-0.4(蓝O型) ~ +2.0(红M型)
  bv: number;
}
interface Planet {
  x: number; y: number; z: number; radius: number;
  imageKey: string; hasRing?: boolean; ringColor?: string;
  rotation: number;
}

let imagesReady = false
const preloadPromise = preloadPlanetImages()

// B-V 色指数 → sRGB（真实恒星色温）
function bvToRgb(bv: number): [number, number, number] {
  // Ballinger-Barnes 近似：B-V → 开尔文温度 → sRGB
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62))
  let r: number, g: number, b: number
  if (t <= 6600) {
    r = 1
    g = 0.39008157876 * Math.log(t / 100) - 0.63184144378
    b = t <= 1900 ? 0 : 0.54320678911 * Math.log((t - 100) / 100) - 1.19625450178
  } else {
    r = 1.29293618606 * Math.pow((t / 100) - 60, -0.1332047592)
    g = 1.1298908609 * Math.pow((t / 100) - 60, -0.0755148492)
    b = 1
  }
  return [
    Math.max(0, Math.min(1, r)) * 255,
    Math.max(0, Math.min(1, g)) * 255,
    Math.max(0, Math.min(1, b)) * 255,
  ]
}

function StarVoyage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = window.innerWidth
    let H = window.innerHeight
    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const cx = () => W / 2
    const cy = () => H / 2
    const focal = 600

    // 三层视差星星（远景 80% + 中景 15% + 近景 5%）
    const farStars: Star3D[] = []
    const midStars: Star3D[] = []
    const nearStars: Star3D[] = []
    for (let i = 0; i < 1400; i++) {
      const bv = (() => {
        // 偏蓝的银河系盘面星分布
        const r = Math.random()
        if (r < 0.25) return -0.3 + Math.random() * 0.2   // 蓝白
        if (r < 0.65) return -0.05 + Math.random() * 0.5  // 白黄
        if (r < 0.9) return 0.5 + Math.random() * 0.7     // 橙
        return 1.2 + Math.random() * 0.8                   // 红
      })()
      const s: Star3D = {
        x: (Math.random() - 0.5) * W * 8,
        y: (Math.random() - 0.5) * H * 8,
        z: Math.random() * 900 + 250,        // 250 - 1150
        baseSize: 0.15 + Math.random() * 0.55,
        twinkleSpeed: 0.0008 + Math.random() * 0.0022,
        twinklePhase: Math.random() * Math.PI * 2,
        bv,
      }
      farStars.push(s)
    }
    for (let i = 0; i < 220; i++) {
      const s: Star3D = {
        x: (Math.random() - 0.5) * W * 6,
        y: (Math.random() - 0.5) * H * 6,
        z: Math.random() * 180 + 80,
        baseSize: 0.6 + Math.random() * 1.2,
        twinkleSpeed: 0.0015 + Math.random() * 0.0035,
        twinklePhase: Math.random() * Math.PI * 2,
        bv: Math.random() < 0.7 ? -0.2 + Math.random() * 0.6 : 0.5 + Math.random() * 1.2,
      }
      midStars.push(s)
    }
    for (let i = 0; i < 55; i++) {
      const s: Star3D = {
        x: (Math.random() - 0.5) * W * 3.5,
        y: (Math.random() - 0.5) * H * 3.5,
        z: Math.random() * 60 + 18,
        baseSize: 1.8 + Math.random() * 3.2,
        twinkleSpeed: 0.0025 + Math.random() * 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        bv: Math.random() < 0.5 ? -0.3 + Math.random() * 0.4 : 0.6 + Math.random() * 1.2,
      }
      nearStars.push(s)
    }

    // 行星配置
    const planets: Planet[] = [
      {
        x: -W * 1.5, y: -H * 0.5, z: 3800,
        radius: 560, imageKey: 'sun', rotation: 0,
      },
      {
        x: W * 1.2, y: -H * 0.35, z: 1600,
        radius: 150, imageKey: 'moon', rotation: 0,
      },
      {
        x: W * 2.2, y: H * 0.3, z: 800,
        radius: 230, imageKey: 'saturn',
        hasRing: true, ringColor: 'rgba(210,175,115,0.5)', rotation: 0,
      },
      {
        x: -W * 1.3, y: H * 0.8, z: 1000,
        radius: 160, imageKey: 'mars', rotation: 0,
      },
      {
        x: W * 1.8, y: H * 1.2, z: 1300,
        radius: 270, imageKey: 'jupiter', rotation: 0,
      },
      {
        x: -W * 0.5, y: H * 0.5, z: 2400,
        radius: 110, imageKey: 'earth', rotation: 0,
      },
    ]

    const project = (x: number, y: number, z: number) => {
      const k = focal / (focal + z)
      return { sx: cx() + x * k, sy: cy() + y * k, k }
    }

    let rafId = 0
    const speed = 0.4
    let frame = 0

    const drawNebula = () => {
      const g1 = ctx.createRadialGradient(W * 0.15, H * 0.25, 0, W * 0.15, H * 0.25, Math.max(W, H) * 0.7)
      g1.addColorStop(0, 'rgba(70, 40, 140, 0.10)')
      g1.addColorStop(0.4, 'rgba(40, 80, 180, 0.05)')
      g1.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, W, H)
      const g2 = ctx.createRadialGradient(W * 0.85, H * 0.75, 0, W * 0.85, H * 0.75, Math.max(W, H) * 0.6)
      g2.addColorStop(0, 'rgba(20, 100, 140, 0.08)')
      g2.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, W, H)
    }

    const drawStarReal = (s: Star3D, now: number) => {
      const { sx, sy, k } = project(s.x, s.y, s.z)
      if (sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) return
      const size = s.baseSize * k * 2.6
      if (size < 0.25) return

      const [r, g, b] = bvToRgb(s.bv)
      const depthAlpha = Math.min(1, 0.15 + k * 0.95)
      const alpha = depthAlpha

      // 核心盘（Gauss 近似）
      const coreR = Math.max(size * 0.55, 0.4)
      const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR * 2.4)
      core.addColorStop(0.0, `rgba(${r|0},${g|0},${b|0},${alpha})`)
      core.addColorStop(0.35, `rgba(${r|0},${g|0},${b|0},${alpha * 0.4})`)
      core.addColorStop(1.0, `rgba(${r|0},${g|0},${b|0},0)`)
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(sx, sy, coreR * 2.4, 0, Math.PI * 2)
      ctx.fill()
    }

    const drawPlanet = (p: Planet) => {
      const { sx, sy, k } = project(p.x, p.y, p.z)
      const R = p.radius * k
      if (R < 3) return
      if (sx < -R * 4 || sx > W + R * 4 || sy < -R * 4 || sy > H + R * 4) return

      // 土星环（画在星球后面，用图片自带的环或独立渲染；不额外做彩色辉光）
      if (p.hasRing && p.ringColor) {
        ctx.save()
        ctx.translate(sx, sy)
        ctx.rotate(-0.4 + p.rotation * 0.005)
        ctx.scale(1, 0.32)
        ctx.globalAlpha = 0.7
        ctx.beginPath()
        ctx.arc(0, 0, R * 1.9, 0, Math.PI * 2)
        ctx.strokeStyle = p.ringColor
        ctx.lineWidth = Math.max(2, R * 0.2)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(0, 0, R * 1.55, 0, Math.PI * 2)
        ctx.strokeStyle = p.ringColor.replace(/[\d.]+\)/, '0.25)')
        ctx.lineWidth = Math.max(1, R * 0.08)
        ctx.stroke()
        ctx.restore()
      }

      // 用图片渲染星球 —— 圆形裁剪，只保留星球本身
      const img = planetImages[p.imageKey]
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(sx, sy, R, 0, Math.PI * 2)
        ctx.clip()
        const imgAspect = img.naturalWidth / img.naturalHeight
        let drawW = R * 2, drawH = R * 2
        if (imgAspect > 1) {
          drawH = R * 2
          drawW = drawH * imgAspect
        } else {
          drawW = R * 2
          drawH = drawW / imgAspect
        }
        ctx.drawImage(img, sx - drawW / 2, sy - drawH / 2, drawW, drawH)
        // 轻微的暗部阴影（右下侧阴影，只压暗不发白光），保持立体感但不留亮圈
        const shadowGrad = ctx.createRadialGradient(
          sx + R * 0.4, sy + R * 0.4, R * 0.3, sx, sy, R
        )
        shadowGrad.addColorStop(0, 'rgba(0,0,0,0)')
        shadowGrad.addColorStop(0.55, 'rgba(0,0,0,0.15)')
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0.55)')
        ctx.fillStyle = shadowGrad
        ctx.fillRect(sx - R, sy - R, R * 2, R * 2)
        ctx.restore()
      } else {
        ctx.save()
        ctx.beginPath()
        ctx.arc(sx, sy, R, 0, Math.PI * 2)
        const grad = ctx.createRadialGradient(sx - R * 0.3, sy - R * 0.3, R * 0.1, sx, sy, R)
        grad.addColorStop(0, 'rgba(200,200,210,0.9)')
        grad.addColorStop(1, 'rgba(20,20,30,1)')
        ctx.fillStyle = grad
        ctx.fill()
        ctx.restore()
      }
    }

    const animate = () => {
      frame++
      const now = performance.now()
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, W, H)
      drawNebula()

      // 远景星 — 慢速漂移
      farStars.forEach(s => {
        s.z -= speed * 2.2
        if (s.z < 150) {
          s.z = 1150
          s.x = (Math.random() - 0.5) * W * 8
          s.y = (Math.random() - 0.5) * H * 8
        }
        drawStarReal(s, now)
      })

      planets.forEach((p, i) => {
        p.z -= speed * 0.5 + i * 0.03
        p.rotation += 0.02
        if (p.z < -200) {
          p.z = 3500 + Math.random() * 1500
          p.x = (Math.random() - 0.5) * W * 5
          p.y = (Math.random() - 0.5) * H * 3.5
        }
      })
      planets.slice().sort((a, b) => b.z - a.z).forEach(drawPlanet)

      // 中景星 — 中速穿越
      midStars.forEach(s => {
        s.z -= speed * 7
        if (s.z < 40) {
          s.z = 260
          s.x = (Math.random() - 0.5) * W * 6
          s.y = (Math.random() - 0.5) * H * 6
        }
        drawStarReal(s, now)
      })

      // 近景星 — 高速穿越
      nearStars.forEach(s => {
        s.z -= speed * 22
        if (s.z < 10) {
          s.z = 78
          s.x = (Math.random() - 0.5) * W * 3.5
          s.y = (Math.random() - 0.5) * H * 3.5
        }
        drawStarReal(s, now)
      })

      rafId = requestAnimationFrame(animate)
    }

    // 等待图片加载完成再开始动画
    preloadPromise.then(() => { imagesReady = true })
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, background: '#000' }}
    />
  )
}

// ── Interstellar Mountains BGM player ────────────────────────────────────────
// 优先播放真实音频 `/mountains.mp3`（请用户把 Hans Zimmer - Mountains 原曲
// 放到 frontend/public/mountains.mp3）。
// 如果 mountains.mp3 不存在，则使用 Web Audio 合成的史诗背景音乐作为降级。
// 重要：start() 会返回一个 Promise<boolean>，所以上层等待真正 start 成功才解锁。
const MOUNTAINS_SRC = '/mountains.mp3'
let _globalCtx: AudioContext | null = null
function getGlobalCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null
    if (!_globalCtx) {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AC) return null
      _globalCtx = new AC()
    }
    return _globalCtx
  } catch {
    return null
  }
}
// 检测 mountains.mp3 是否存在（只检测一次）
let _mountainsProbe: Promise<boolean> | null = null
function probeMountains(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (_mountainsProbe != null) return _mountainsProbe
  _mountainsProbe = fetch(MOUNTAINS_SRC, { method: 'HEAD' })
    .then(r => r.ok)
    .catch(() => false)
  return _mountainsProbe
}

function useAmbientMusic() {
  // 真实音频（mountains.mp3）的播放句柄
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Web Audio 合成（降级）的句柄
  const waCtxRef = useRef<AudioContext | null>(null)
  const waGainRef = useRef<GainNode | null>(null)
  const waNodesRef = useRef<AudioScheduledSourceNode[]>([])
  const waLoopRef = useRef<number | null>(null)
  const waStopRef = useRef(false)
  const waFadeRef = useRef<number | null>(null)

  const playingRef = useRef(false)
  const startingRef = useRef(false)

  const start = useCallback(async (): Promise<boolean> => {
    if (playingRef.current) return true
    if (startingRef.current) return false
    startingRef.current = true

    const clean = () => { startingRef.current = false }

    try {
      // ── 1. 取/创建 AudioContext 并 resume（真实音频也需要用户手势解锁）──
      let ctx = getGlobalCtx()
      if (ctx && ctx.state === 'suspended') {
        try { await ctx.resume() } catch {}
      }
      ctx = getGlobalCtx()
      if (!ctx || ctx.state !== 'running') {
        clean()
        return false
      }

      // ── 2. 优先播放 mountains.mp3 ──
      const hasMountains = await probeMountains()
      if (hasMountains) {
        let el = audioRef.current
        if (!el) {
          el = new Audio(MOUNTAINS_SRC)
          el.loop = true
          el.crossOrigin = 'anonymous'
          el.preload = 'auto'
          el.volume = 0
          audioRef.current = el
        }
        el.volume = 0
        try {
          await el.play()
        } catch {
          clean()
          return false
        }
        // 4 秒淡入（和合成版本一致）
        const startVol = el.volume
        const targetVol = 0.78
        const fadeDurMs = 4000
        const t0 = performance.now()
        const fade = () => {
          if (!audioRef.current || !playingRef.current) return
          const p = Math.min(1, (performance.now() - t0) / fadeDurMs)
          audioRef.current.volume = startVol + (targetVol - startVol) * p
          if (p < 1) waFadeRef.current = requestAnimationFrame(fade)
          else waFadeRef.current = null
        }
        waFadeRef.current = requestAnimationFrame(fade)

        playingRef.current = true
        try { sessionStorage.setItem('verinx_audio_unlocked', '1') } catch {}
        clean()
        return true
      }

      // ── 3. 降级：Web Audio 合成史诗背景音乐 ──
      waStopRef.current = false
      waCtxRef.current = ctx
      return await startSynthetic(ctx)
    } catch {
      clean()
      return false
    }
  }, [])

  // 合成版 Interstellar Mountains 风格 BGM（管风琴音色 + D小调）
  const startSynthetic = useCallback(async (ctx: AudioContext): Promise<boolean> => {
    const clean = () => { startingRef.current = false }
    try {
      waNodesRef.current = []

      // ── Master chain：渐强 + 大量混响 ──
      const masterGain = ctx.createGain()
      masterGain.gain.setValueAtTime(0, ctx.currentTime)
      masterGain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 6)
      masterGain.connect(ctx.destination)
      waGainRef.current = masterGain

      // 长延迟混响（模拟大教堂空间感）
      const delay1 = ctx.createDelay(4.0); delay1.delayTime.value = 0.6
      const delay2 = ctx.createDelay(4.0); delay2.delayTime.value = 0.87
      const fb = ctx.createGain(); fb.gain.value = 0.42
      const wetGain = ctx.createGain(); wetGain.gain.value = 0.55
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800
      delay1.connect(fb); fb.connect(delay2); delay2.connect(delay1)
      delay1.connect(lp); lp.connect(wetGain); wetGain.connect(masterGain)
      const dryGain = ctx.createGain(); dryGain.gain.value = 0.8; dryGain.connect(masterGain)
      const dest = ctx.createGain()
      const splitWet = ctx.createGain(); splitWet.gain.value = 1
      dest.connect(dryGain); dest.connect(splitWet); splitWet.connect(delay1)

      // ── 管风琴音色：多层谐波叠加模拟真实管风琴注册 ──
      // 8' Diapason (基频) + 4' Octave (2倍频) + 2 2/3' Quint (3倍频) + 2' Super-Octave (4倍频)
      const playOrganNote = (
        freq: number, startTime: number, duration: number, volume: number,
      ) => {
        // 每层谐波的音量比例（模拟管风琴 stop registration）
        const harmonics = [
          { mult: 1.0, vol: 1.0, type: 'sine' as OscillatorType },       // 8' Principal
          { mult: 2.0, vol: 0.45, type: 'sine' as OscillatorType },      // 4' Octave
          { mult: 3.0, vol: 0.18, type: 'sine' as OscillatorType },      // 2 2/3' Quint
          { mult: 4.0, vol: 0.10, type: 'sine' as OscillatorType },      // 2' Super-Octave
        ]
        harmonics.forEach(({ mult, vol, type }) => {
          const osc = ctx.createOscillator()
          osc.type = type
          osc.frequency.value = freq * mult
          const g = ctx.createGain()
          g.connect(dest)
          // 管风琴包络：快速起音 → 持续 → 缓慢释放（无衰减阶段，像真正的管风琴）
          const atk = 0.35
          const v = volume * vol
          g.gain.setValueAtTime(0.0001, startTime)
          g.gain.linearRampToValueAtTime(v, startTime + atk)
          g.gain.setValueAtTime(v, startTime + duration - 0.5)
          g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration + 0.8)
          osc.start(startTime)
          osc.stop(startTime + duration + 1.0)
          waNodesRef.current.push(osc)
        })
      }

      // ── 低音 Pedal Drone：D1 + D2 持续低音（Mountains 的低频基础）──
      ;[36.71, 73.42].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'; osc.frequency.value = freq
        const g = ctx.createGain()
        // 极缓慢的呼吸式动态
        const breathPeriod = 16
        const scheduleBreath = (baseT: number) => {
          if (waStopRef.current) return
          g.gain.setValueAtTime(0.0001, baseT)
          g.gain.linearRampToValueAtTime(i === 0 ? 0.07 : 0.04, baseT + 4)
          g.gain.setValueAtTime(i === 0 ? 0.07 : 0.04, baseT + breathPeriod - 4)
          g.gain.linearRampToValueAtTime(0.0001, baseT + breathPeriod)
        }
        osc.connect(g); g.connect(dest); osc.start()
        waNodesRef.current.push(osc)
        for (let k = 0; k < 8; k++) scheduleBreath(ctx.currentTime + k * breathPeriod)
      })

      // ── 持续和弦层：Dm (D-F-A) 缓慢呼吸 ──
      // D minor: D3=146.83, F3=174.61, A3=220.00
      const chordNotes = [146.83, 174.61, 220.00]
      chordNotes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'; osc.frequency.value = freq
        const g = ctx.createGain()
        const breathPeriod = 12
        const phase = i * 2 // 错开呼吸
        const scheduleBreath = (baseT: number) => {
          if (waStopRef.current) return
          const t = baseT + phase
          g.gain.setValueAtTime(0.0001, t)
          g.gain.linearRampToValueAtTime(0.025, t + 3)
          g.gain.setValueAtTime(0.025, t + breathPeriod - 3)
          g.gain.linearRampToValueAtTime(0.0001, t + breathPeriod)
        }
        osc.connect(g); g.connect(dest); osc.start()
        waNodesRef.current.push(osc)
        for (let k = 0; k < 10; k++) scheduleBreath(ctx.currentTime + k * breathPeriod)
      })

      // ── Mountains 主旋律：D小调 4 音上升模式 ──
      // D4=293.66, E4=329.63, F4=349.23, G4=392.00, A4=440.00
      // D5=587.33, E5=659.25, F5=698.46, G5=783.99, A5=880.00
      // Mountains 的标志性旋律：D-E-F-G 缓慢上升，然后变化重复
      const melody: { f: number; d: number; v: number }[] = [
        // 第一段：低音区 4 音上升
        { f: 293.66, d: 3.5, v: 0.06 },  // D4
        { f: 329.63, d: 3.0, v: 0.06 },  // E4
        { f: 349.23, d: 3.0, v: 0.065 }, // F4
        { f: 392.00, d: 4.0, v: 0.07 },  // G4
        // 第二段：回到 D4 再上升
        { f: 293.66, d: 3.0, v: 0.06 },  // D4
        { f: 349.23, d: 3.0, v: 0.065 }, // F4
        { f: 392.00, d: 3.0, v: 0.07 },  // G4
        { f: 440.00, d: 4.5, v: 0.075 }, // A4
        // 第三段：高音区上升
        { f: 587.33, d: 3.5, v: 0.07 },  // D5
        { f: 659.25, d: 3.0, v: 0.07 },  // E5
        { f: 698.46, d: 3.0, v: 0.075 }, // F5
        { f: 783.99, d: 5.0, v: 0.08 },  // G5
        // 第四段：回落
        { f: 587.33, d: 3.5, v: 0.065 }, // D5
        { f: 440.00, d: 3.0, v: 0.06 },  // A4
        { f: 392.00, d: 3.0, v: 0.055 }, // G4
        { f: 293.66, d: 5.5, v: 0.05 },  // D4
      ]

      const schedulePhrase = (baseTime: number) => {
        let t = baseTime
        melody.forEach(({ f, d, v }) => {
          if (waStopRef.current) return
          playOrganNote(f, t, d * 0.92, v)
          // 低八度和声（让旋律更厚重）
          playOrganNote(f / 2, t + 0.15, d * 0.85, v * 0.4)
          t += d
        })
        return t
      }

      const loop = () => {
        if (waStopRef.current || !waCtxRef.current) return
        const endTime = schedulePhrase(waCtxRef.current.currentTime + 0.3)
        const loopMs = Math.max((endTime - waCtxRef.current.currentTime) * 1000 - 500, 200)
        waLoopRef.current = window.setTimeout(loop, loopMs)
      }
      loop()

      playingRef.current = true
      try { sessionStorage.setItem('verinx_audio_unlocked', '1') } catch {}
      clean()
      return true
    } catch {
      clean()
      return false
    }
  }, [])

  const stop = useCallback(() => {
    if (waFadeRef.current) { cancelAnimationFrame(waFadeRef.current); waFadeRef.current = null }
    if (!playingRef.current && !startingRef.current) return
    playingRef.current = false
    startingRef.current = false

    // 真实音频：800ms 淡出然后 pause
    const audio = audioRef.current
    if (audio && !audio.paused) {
      const startVol = audio.volume
      const dur = 800
      const t0 = performance.now()
      const fade = () => {
        const p = Math.min(1, (performance.now() - t0) / dur)
        if (audioRef.current) audioRef.current.volume = startVol * (1 - p)
        if (p < 1) {
          requestAnimationFrame(fade)
        } else {
          try {
            if (audioRef.current) {
              audioRef.current.pause()
              audioRef.current.currentTime = 0
            }
          } catch {}
        }
      }
      requestAnimationFrame(fade)
    }

    // Web Audio 合成：800ms 淡出然后关闭
    waStopRef.current = true
    if (waLoopRef.current) { clearTimeout(waLoopRef.current); waLoopRef.current = null }
    const ctx = waCtxRef.current
    const gain = waGainRef.current
    waCtxRef.current = null
    waGainRef.current = null
    const nodes = waNodesRef.current.slice()
    waNodesRef.current = []
    if (ctx && gain) {
      try {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8)
      } catch {}
      setTimeout(() => {
        nodes.forEach(n => { try { n.stop() } catch {} })
      }, 1200)
    }
  }, [])

  return useMemo(() => ({ start, stop }), [start, stop])
}

const TIER_META = {
  synapse: { name: 'SYNAPSE', icon: '⟁', color: '#6b7280' },
  quantum: { name: 'QUANTUM', icon: '◈', color: '#22d3ee' },
  singularity: { name: 'SINGULARITY', icon: '◉', color: '#818cf8' },
  transcend: { name: 'TRANSCEND', icon: '◐', color: '#f0f0fa' },
}

export function HomePage() {
  const navigate = useNavigate()
  const [showSubtitle, setShowSubtitle] = useState(false)
  const [showButtons, setShowButtons] = useState(false)
  const [showTopLabel, setShowTopLabel] = useState(false)
  const { isAuthenticated, user } = useAuthStore()
  const ambient = useAmbientMusic()
  const musicStartedRef = useRef(false)

  const [checkin, setCheckin] = useState<CheckinStatus | null>(null)
  const [highScore, setHighScore] = useState(0)
  const [loading, setLoading] = useState(false)

  // 只在未登录的落地页启动音乐；导航/登录时立即停止
  // 策略：
  //  1) 组件挂载且未登录时，立即尝试启动（sessionStorage 已解锁或 context 已经过 resume 可直接播）
  //  2) 若失败，则通过最广泛的捕获式事件（pointerdown / touchstart / mousedown / keydown / wheel / click）
  //     在 document 上反复重试，直到真正启动为止
  //  3) 登录 / 卸载 / 跳转 → 立即停止
  useEffect(() => {
    if (isAuthenticated) {
      ambient.stop()
      musicStartedRef.current = false
      return
    }
    let cancelled = false

    const removeListeners = (fn: EventListener) => {
      document.removeEventListener('pointerdown', fn, true)
      document.removeEventListener('mousedown', fn, true)
      document.removeEventListener('touchstart', fn, true)
      document.removeEventListener('keydown', fn, true)
      document.removeEventListener('wheel', fn, true)
      document.removeEventListener('click', fn, true)
    }
    const addListeners = (fn: EventListener) => {
      document.addEventListener('pointerdown', fn, true)
      document.addEventListener('mousedown', fn, true)
      document.addEventListener('touchstart', fn, true)
      document.addEventListener('keydown', fn, true)
      document.addEventListener('wheel', fn, true)
      document.addEventListener('click', fn, true)
    }

    const tryStartAsync = async (): Promise<boolean> => {
      if (musicStartedRef.current || cancelled) return true
      try {
        const ok = await ambient.start()
        if (cancelled) return false
        if (ok) {
          musicStartedRef.current = true
          removeListeners(tryStartSync as any)
          return true
        }
      } catch {}
      return false
    }
    // 事件回调返回值没有意义，所以包装一个同步签名
    const tryStartSync = () => {
      tryStartAsync()
    }

    // ── 立即尝试（返回首页时，或 sessionStorage 已标记解锁时生效）──
    const wasUnlocked = (() => {
      try { return sessionStorage.getItem('verinx_audio_unlocked') === '1' } catch { return false }
    })()
    if (wasUnlocked) {
      tryStartAsync()
    } else {
      tryStartAsync()
    }

    addListeners(tryStartSync as any)

    return () => {
      cancelled = true
      removeListeners(tryStartSync as any)
      ambient.stop()
      musicStartedRef.current = false
    }
  }, [isAuthenticated, ambient])

  // 页面导航时停止音乐
  const handleNavigate = useCallback(async (path: string) => {
    // 先尝试启动音乐（这个 click 本身就是用户手势，保证"点登录开始"之前一定能解锁）
    try { await ambient.start() } catch {}
    // 然后停止 + 跳转
    ambient.stop()
    musicStartedRef.current = false
    playSound('click')
    navigate(path)
  }, [ambient, navigate])

  useEffect(() => {
    const t0 = setTimeout(() => setShowTopLabel(true), 300)
    const t1 = setTimeout(() => setShowSubtitle(true), 3200)
    const t2 = setTimeout(() => setShowButtons(true), 4200)
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    api.get('/stats/checkin-status')
      .then((r) => setCheckin(r.data.data || r.data))
      .catch(() => {})
    const stored = localStorage.getItem('verinx_challenge_highscore')
    if (stored) setHighScore(parseFloat(stored))
    setLoading(false)
  }, [isAuthenticated])

  const today = new Date()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const todayStr = `${today.getMonth() + 1}月${today.getDate()}日 · ${weekdays[today.getDay()]}`

  const currentTier = (() => {
    const streak = checkin?.streak_days ?? 0
    if (streak >= 365) return { tier: 'transcend', ...TIER_META.transcend }
    if (streak >= 100) return { tier: 'singularity', ...TIER_META.singularity }
    if (streak >= 30) return { tier: 'quantum', ...TIER_META.quantum }
    if (streak >= 7) return { tier: 'synapse', ...TIER_META.synapse }
    return null
  })()

  if (isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-6 py-16 bg-black relative overflow-hidden">
        <StarVoyage />

        <div className="max-w-2xl mx-auto w-full relative z-10">
          <div className="text-center mb-8" style={{ animation: 'fadeInDown 600ms ease-out forwards' }}>
            <span className="text-[10px] uppercase-spacex tracking-[0.25em] text-[#808080]">
              {todayStr}
            </span>
          </div>

          <div className="space-y-5">
            <Link
              to="/checkin"
              className="group block relative border border-[rgba(240,240,250,0.08)] p-10 hover:border-[rgba(240,240,250,0.25)] transition-spacex text-center overflow-hidden"
              style={{ animation: 'fadeInUp 700ms ease-out 200ms both' }}
              onClick={() => playSound('click')}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(240,240,250,0.04) 0%, transparent 70%)' }}
              />
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-8 h-8 flex items-center justify-center border border-[rgba(240,240,250,0.1)] group-hover:border-[rgba(240,240,250,0.3)] transition-spacex">
                    <span className="text-sm text-[rgba(240,240,250,0.5)] group-hover:text-[#F0F0FA] transition-spacex">◈</span>
                  </div>
                  <div className="text-[13px] uppercase-spacex tracking-[0.25em] text-[#808080] group-hover:text-[rgba(240,240,250,0.7)] transition-spacex">
                    每日打卡
                  </div>
                </div>
                {checkin && checkin.streak_days > 0 ? (
                  <div className="flex items-baseline justify-center gap-3">
                    <span className="font-display tabular-nums text-[#F0F0FA] leading-none group-hover:scale-105 transition-transform duration-500"
                      style={{ fontSize: '96px', textShadow: '0 0 30px rgba(240,240,250,0.15)' }}
                    >
                      {checkin.streak_days}
                    </span>
                    <span className="text-sm uppercase-spacex tracking-[0.2em] text-[#808080]">天连胜</span>
                  </div>
                ) : (
                  <div className="text-base text-[rgba(240,240,250,0.4)] py-6">开始第一天</div>
                )}
                <div className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 border border-[rgba(240,240,250,0.15)] group-hover:border-[rgba(240,240,250,0.4)] group-hover:bg-[rgba(240,240,250,0.06)] transition-spacex">
                  <span className="text-[11px] uppercase-spacex tracking-[0.2em] text-[rgba(240,240,250,0.5)] group-hover:text-[#F0F0FA]">
                    {checkin?.checked_today ? '继续练习' : '去打卡'}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="transition-transform group-hover:translate-x-1 text-[rgba(240,240,250,0.5)] group-hover:text-[#F0F0FA]">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            <Link
              to="/challenge"
              className="group block relative border border-[rgba(34,211,238,0.08)] p-10 hover:border-[rgba(34,211,238,0.25)] transition-spacex text-center overflow-hidden"
              style={{ animation: 'fadeInUp 700ms ease-out 400ms both' }}
              onClick={() => playSound('click')}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.05) 0%, transparent 70%)' }}
              />
              <div className="relative z-10">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-8 h-8 flex items-center justify-center border border-[rgba(34,211,238,0.1)] group-hover:border-[rgba(34,211,238,0.3)] transition-spacex">
                    <span className="text-sm text-[rgba(34,211,238,0.5)] group-hover:text-[#22d3ee] transition-spacex">◉</span>
                  </div>
                  <div className="text-[13px] uppercase-spacex tracking-[0.25em] text-[#808080] group-hover:text-[rgba(34,211,238,0.7)] transition-spacex">
                    极限挑战
                  </div>
                </div>
                {highScore > 0 ? (
                  <div className="flex items-baseline justify-center gap-3">
                    <span className="font-display tabular-nums text-[#F0F0FA] leading-none group-hover:scale-105 transition-transform duration-500"
                      style={{ fontSize: '96px', textShadow: '0 0 30px rgba(34,211,238,0.12)' }}
                    >
                      {Math.round(highScore)}
                    </span>
                    <span className="text-sm uppercase-spacex tracking-[0.2em] text-[#808080]">最高分</span>
                  </div>
                ) : (
                  <div className="text-base text-[rgba(240,240,250,0.4)] py-6">暂无记录</div>
                )}
                <div className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 border border-[rgba(34,211,238,0.15)] group-hover:border-[rgba(34,211,238,0.4)] group-hover:bg-[rgba(34,211,238,0.06)] transition-spacex">
                  <span className="text-[11px] uppercase-spacex tracking-[0.2em] text-[rgba(34,211,238,0.5)] group-hover:text-[#22d3ee]">去挑战</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="transition-transform group-hover:translate-x-1 text-[rgba(34,211,238,0.5)] group-hover:text-[#22d3ee]">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>

          {/* 星际续航日志 */}
          {checkin && (
            <div className="mt-8 w-full max-w-3xl"
              style={{ animation: 'fadeInUp 700ms ease-out 600ms both' }}
            >
              <StreakDisplay
                streakDays={checkin.streak_days}
                maxStreakDays={checkin.max_streak_days}
              />
            </div>
          )}

          <div className="mt-8 flex items-center justify-center gap-3"
            style={{ animation: 'fadeInUp 600ms ease-out 800ms both' }}
          >
            <span className="w-1.5 h-1.5 bg-[#22c55e] animate-pulse" />
            <span className="text-[10px] uppercase-spacex text-[#808080] tracking-[0.2em]">AI 引擎在线</span>
          </div>
        </div>

        <style>{`
          @keyframes fadeInUp {
            0% { opacity: 0; transform: translateY(20px); }
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

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center px-6 relative pt-16 pb-24 overflow-hidden">
      <div className="absolute inset-0 bg-black" />
      <StarVoyage />

      <div className="relative z-10 text-center max-w-4xl w-full flex flex-col items-center">
        <div
          className="text-xs uppercase-spacex text-[#808080] tracking-[0.3em] mb-2"
          style={{ opacity: showTopLabel ? 1 : 0, transition: 'opacity 600ms ease-out' }}
        >
          AI-POWERED INTERVIEW PREPARATION
        </div>

        <div
          className="relative w-full h-[200px] flex items-center justify-center"
          style={{ animation: 'fadeInDown 800ms ease-out both' }}
        >
          <span
            className="text-[64px] md:text-[72px] font-bold tracking-[0.08em] text-[#F0F0FA]"
            style={{ fontFamily: 'Inter, SF Pro Display, sans-serif', textShadow: '0 0 24px rgba(240,240,250,0.25), 0 0 48px rgba(240,240,250,0.1)' }}
          >
            VERINX
          </span>
        </div>

        <div
          className="mt-2"
          style={{
            opacity: showSubtitle ? 1 : 0,
            transform: showSubtitle ? 'translateY(0)' : 'translateY(8px)',
            transition: 'all 1200ms cubic-bezier(0.19, 1, 0.22, 1)',
          }}
        >
          <p className="text-lg md:text-xl text-[rgba(240,240,250,0.8)] font-body tracking-wide leading-relaxed">
            求真思辨 面见未来
          </p>
        </div>

        <div
          className="mt-10 flex flex-col items-center"
          style={{
            opacity: showButtons ? 1 : 0,
            transform: showButtons ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 1000ms cubic-bezier(0.19, 1, 0.22, 1)',
          }}
        >
          <button
            onClick={() => handleNavigate('/login')}
            className="group border border-[rgba(240,240,250,0.35)] px-16 py-5 hover:bg-[rgba(240,240,250,0.1)] transition-spacex relative overflow-hidden"
          >
            <span className="relative z-10 text-xs uppercase-spacex tracking-[0.15em]">登录开始</span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(240,240,250,0.08), transparent)' }}
            />
          </button>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
        <span className="text-[10px] uppercase-spacex text-[#808080] tracking-[0.2em]">AI 引擎在线</span>
        <span className="w-2 h-2 bg-[#22c55e] animate-pulse" />
      </div>
    </div>
  )
}
