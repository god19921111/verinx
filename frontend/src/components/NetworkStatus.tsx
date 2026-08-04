import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

/** 全局断网检测提示条 */
export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white text-center py-2 text-sm flex items-center justify-center gap-2">
      <WifiOff className="w-4 h-4" />
      网络连接已断开，请检查网络后重试
    </div>
  )
}
