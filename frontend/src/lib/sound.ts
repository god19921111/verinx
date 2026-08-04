/**
 * 全局音效系统（多邻国风格）
 * - 无需加载外部音频资源，使用 WebAudio 合成
 * - 支持静音设置（localStorage：sound-enabled）
 */

export type SoundName =
  | 'click'        // 普通按钮点击
  | 'success'      // 操作成功
  | 'fail'         // 失败/错误
  | 'checkin'      // 打卡成功（音阶上行）
  | 'challenge'    // 开始挑战
  | 'score'        // 生成评分报告
  | 'timer'        // 倒计时结束
  | 'toast'        // 轻提示

let _ctx: AudioContext | null = null
let _enabled: boolean | null = null

function getCtx(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null
    if (!_ctx) {
      const AC =
        (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AC) return null
      _ctx = new AC()
    }
    // 浏览器自动播放策略：需要首次交互后 resume
    const ctx = _ctx as AudioContext | null
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    return ctx
  } catch {
    return null
  }
}

export function isSoundEnabled(): boolean {
  if (_enabled === null) {
    const v = localStorage.getItem('sound-enabled')
    _enabled = v === null ? true : v === '1'
  }
  return _enabled
}

export function setSoundEnabled(enabled: boolean) {
  _enabled = enabled
  localStorage.setItem('sound-enabled', enabled ? '1' : '0')
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.15, when = 0) {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(g)
  g.connect(ctx.destination)

  const start = ctx.currentTime + when
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

export function playSound(name: SoundName) {
  switch (name) {
    case 'click':
      // 短促清脆的点击音
      playTone(880, 0.06, 'triangle', 0.1)
      playTone(1320, 0.04, 'sine', 0.06, 0.005)
      break

    case 'success':
      // 上行三度和弦：C5-E5-G5
      playTone(523.25, 0.2, 'triangle', 0.12, 0)
      playTone(659.25, 0.2, 'triangle', 0.1, 0.07)
      playTone(783.99, 0.28, 'triangle', 0.12, 0.14)
      break

    case 'fail':
      // 下行小二度：C5 → B4
      playTone(523.25, 0.18, 'sawtooth', 0.06, 0)
      playTone(493.88, 0.28, 'sawtooth', 0.08, 0.1)
      break

    case 'checkin':
      // 打卡成功：欢快的音阶上行（类似多邻国）
      playTone(523.25, 0.12, 'triangle', 0.12, 0.00)
      playTone(587.33, 0.12, 'triangle', 0.12, 0.08)
      playTone(659.25, 0.12, 'triangle', 0.12, 0.16)
      playTone(783.99, 0.16, 'triangle', 0.14, 0.24)
      playTone(1046.5, 0.28, 'triangle', 0.15, 0.34)
      break

    case 'challenge':
      // 挑战开始：科幻感启动序列（低鸣→扫描→锁定）
      playTone(150, 0.12, 'sawtooth', 0.08, 0)
      playTone(300, 0.1, 'square', 0.06, 0.1)
      playTone(600, 0.1, 'square', 0.08, 0.2)
      playTone(1200, 0.18, 'triangle', 0.12, 0.32)
      playTone(1800, 0.22, 'sine', 0.1, 0.42)
      break

    case 'score':
      // 生成评分：五音音阶
      playTone(440, 0.1, 'triangle', 0.08, 0.00)
      playTone(554.37, 0.1, 'triangle', 0.1, 0.08)
      playTone(659.25, 0.1, 'triangle', 0.1, 0.16)
      playTone(880, 0.22, 'triangle', 0.14, 0.24)
      break

    case 'timer':
      // 倒计时结束：滴答三次+结束音
      playTone(1000, 0.05, 'square', 0.08, 0)
      playTone(1000, 0.05, 'square', 0.08, 0.18)
      playTone(1200, 0.2, 'triangle', 0.15, 0.36)
      break

    case 'toast':
      // 轻提示
      playTone(1760, 0.05, 'sine', 0.08, 0)
      break

    default:
      break
  }

  // 设备微震动（多邻国风格，移动端生效）
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).vibrate) {
      switch (name) {
        case 'click':
          (navigator as any).vibrate?.(10)
          break
        case 'success':
          (navigator as any).vibrate?.([10, 20, 10])
          break
        case 'fail':
          (navigator as any).vibrate?.(30)
          break
        case 'checkin':
          (navigator as any).vibrate?.([10, 20, 10, 20, 20])
          break
        case 'challenge':
          (navigator as any).vibrate?.([30, 20, 40])
          break
        case 'timer':
          (navigator as any).vibrate?.([20, 30, 40])
          break
        default:
          break
      }
    }
  } catch {
    /* ignore */
  }
}
