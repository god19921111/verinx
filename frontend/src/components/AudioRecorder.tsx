import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  onTranscript: (text: string) => void
  disabled?: boolean
  processing?: boolean
}

/** 将 PCM 采样数据编码为 WAV 格式 Blob */
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([view], { type: 'audio/wav' })
}

export function AudioRecorder({ onRecordingComplete, onTranscript, disabled = false, processing = false }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const pcmChunksRef = useRef<Float32Array[]>([])

  const startTimer = useCallback(() => {
    setDuration(0)
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1)
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    setShowTextInput(false)
    pcmChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        pcmChunksRef.current.push(new Float32Array(inputData))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)
      startTimer()
    } catch {
      if (navigator.mediaDevices === undefined) {
        setError('您的浏览器不支持录音功能，请使用文字输入')
      } else {
        setError('无法访问麦克风，请检查浏览器权限设置或使用文字输入')
      }
      setShowTextInput(true)
    }
  }, [startTimer])

  const stopRecording = useCallback(() => {
    // 停止音频处理
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    // 合并 PCM 数据并编码为 WAV
    const chunks = pcmChunksRef.current
    if (chunks.length > 0) {
      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
      const merged = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      const wavBlob = encodeWAV(merged, 16000)
      onRecordingComplete(wavBlob)
    }

    pcmChunksRef.current = []
    setIsRecording(false)
    stopTimer()
  }, [onRecordingComplete, stopTimer])

  useEffect(() => {
    return () => {
      stopTimer()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stopTimer])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const handleTextSubmit = () => {
    const text = textInput.trim()
    if (text) {
      onTranscript(text)
      setTextInput('')
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 录音按钮 */}
      <button
        type="button"
        disabled={disabled}
        onClick={isRecording ? stopRecording : startRecording}
        className={cn(
          'relative w-20 h-20 rounded-full flex items-center justify-center transition-all',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isRecording
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md',
        )}
      >
        {isRecording && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40" />
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-8 h-8"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </button>

      {/* 录音状态文字 */}
      <div className="text-center">
        {processing ? (
          <>
            <p className="text-sm font-medium text-amber-600">语音转文字中...</p>
            <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mt-1" />
          </>
        ) : isRecording ? (
          <>
            <p className="text-sm font-medium text-red-500">录音中...</p>
            <p className="text-2xl font-mono tabular-nums text-foreground">{formatDuration(duration)}</p>
            <p className="text-xs text-muted-foreground mt-1">点击结束录音，自动转为文字</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">点击开始录音</p>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="text-sm text-destructive text-center max-w-xs">{error}</p>
      )}

      {/* 文字输入切换 */}
      <button
        type="button"
        onClick={() => setShowTextInput((prev) => !prev)}
        className="text-sm text-primary hover:underline"
        disabled={disabled}
      >
        {showTextInput ? '收起文字输入' : '使用文字输入'}
      </button>

      {/* 文字输入区域 */}
      {showTextInput && (
        <div className="w-full max-w-md flex flex-col gap-2">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="请输入您的回答内容..."
            rows={4}
            disabled={disabled}
            className={cn(
              'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50 resize-none',
            )}
          />
          <button
            type="button"
            onClick={handleTextSubmit}
            disabled={disabled || !textInput.trim()}
            className={cn(
              'self-end px-4 py-2 rounded-lg text-sm font-medium',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            提交回答
          </button>
        </div>
      )}
    </div>
  )
}
