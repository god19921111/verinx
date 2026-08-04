import { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  enabled: boolean
}

export function VideoRecorder({ onRecordingComplete, enabled }: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 开启摄像头预览
  useEffect(() => {
    let cancelled = false

    async function startPreview() {
      if (!enabled) return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setError(null)
      } catch {
        if (!cancelled) {
          setError('无法访问摄像头，请检查浏览器权限设置')
        }
      }
    }

    startPreview()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [enabled])

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

  const startRecording = useCallback(() => {
    if (!streamRef.current) return
    setError(null)

    const mediaRecorder = new MediaRecorder(streamRef.current)
    mediaRecorderRef.current = mediaRecorder
    chunksRef.current = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      onRecordingComplete(blob)
    }

    mediaRecorder.start()
    setIsRecording(true)
    startTimer()
  }, [onRecordingComplete, startTimer])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    stopTimer()
  }, [stopTimer])

  useEffect(() => {
    return () => {
      stopTimer()
    }
  }, [stopTimer])

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  if (!enabled) return null

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 视频预览 */}
      <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {/* 录制状态指示 */}
        {isRecording && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full px-3 py-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-medium">REC {formatDuration(duration)}</span>
          </div>
        )}
      </div>

      {/* 控制按钮 */}
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={!!error}
        className={cn(
          'px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          isRecording
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {isRecording ? '停止录制' : '开始录制'}
      </button>

      {/* 错误提示 */}
      {error && (
        <p className="text-sm text-destructive text-center max-w-xs">{error}</p>
      )}
    </div>
  )
}
