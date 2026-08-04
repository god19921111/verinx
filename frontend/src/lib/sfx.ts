// 轻量音效引擎：Web Audio API 生成，零外部依赖

let _ctx: AudioContext | null = null
let _muted = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return null
    }
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume().catch(() => {})
  }
  return _ctx
}

interface ToneOpts {
  freq: number
  duration: number
  type?: OscillatorType
  volume?: number
  delay?: number
  sweep?: number // 频率扫描终点
}

function tone({ freq, duration, type = 'sine', volume = 0.15, delay = 0, sweep }: ToneOpts) {
  if (_muted) return
  const ctx = getCtx()
  if (!ctx) return
  const t0 = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (sweep) {
    osc.frequency.exponentialRampToValueAtTime(sweep, t0 + duration)
  }
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

// 步骤切换：清脆短音
function stepTransition() {
  tone({ freq: 880, duration: 0.08, type: 'sine', volume: 0.1 })
  tone({ freq: 1320, duration: 0.08, type: 'sine', volume: 0.08, delay: 0.06 })
}

// 倒计时滴答（最后30秒常规提醒）
function tick() {
  tone({ freq: 1200, duration: 0.04, type: 'square', volume: 0.06 })
}

// 倒计时最后10秒：更急促、更有张力
function tickUrgent() {
  tone({ freq: 1800, duration: 0.05, type: 'square', volume: 0.12 })
  tone({ freq: 2200, duration: 0.08, type: 'triangle', volume: 0.08, delay: 0.04 })
}

// 时间到
function timeUp() {
  tone({ freq: 440, duration: 0.15, type: 'sawtooth', volume: 0.12 })
  tone({ freq: 330, duration: 0.25, type: 'sawtooth', volume: 0.1, delay: 0.12 })
}

// 提交答案：上扬音
function submit() {
  tone({ freq: 523, duration: 0.08, type: 'sine', volume: 0.1 })
  tone({ freq: 659, duration: 0.08, type: 'sine', volume: 0.1, delay: 0.06 })
  tone({ freq: 784, duration: 0.12, type: 'sine', volume: 0.1, delay: 0.12 })
}

// 评分出来：根据分数不同播放不同音效
function scoreReveal(score: number) {
  if (score >= 80) {
    // 高分：欢快上扬
    tone({ freq: 523, duration: 0.1, type: 'sine', volume: 0.12 })
    tone({ freq: 659, duration: 0.1, type: 'sine', volume: 0.12, delay: 0.08 })
    tone({ freq: 784, duration: 0.1, type: 'sine', volume: 0.12, delay: 0.16 })
    tone({ freq: 1047, duration: 0.2, type: 'sine', volume: 0.12, delay: 0.24 })
  } else if (score >= 60) {
    // 中等：平静双音
    tone({ freq: 523, duration: 0.1, type: 'sine', volume: 0.1 })
    tone({ freq: 440, duration: 0.15, type: 'sine', volume: 0.1, delay: 0.1 })
  } else {
    // 低分：下沉音
    tone({ freq: 440, duration: 0.1, type: 'sine', volume: 0.1 })
    tone({ freq: 330, duration: 0.15, type: 'sine', volume: 0.1, delay: 0.1 })
    tone({ freq: 247, duration: 0.2, type: 'sine', volume: 0.1, delay: 0.22 })
  }
}

// 小结弹窗弹出
function summary() {
  tone({ freq: 659, duration: 0.1, type: 'sine', volume: 0.1 })
  tone({ freq: 880, duration: 0.1, type: 'sine', volume: 0.1, delay: 0.08 })
  tone({ freq: 1047, duration: 0.15, type: 'sine', volume: 0.1, delay: 0.16 })
}

export const sfx = {
  stepTransition,
  tick,
  tickUrgent,
  timeUp,
  submit,
  scoreReveal,
  summary,
  unlock: () => { getCtx() },
  setMuted: (m: boolean) => { _muted = m },
}
