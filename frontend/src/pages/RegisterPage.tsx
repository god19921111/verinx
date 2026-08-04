import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

export function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendCode = async () => {
    if (countdown > 0 || !phone) return
    setError('')
    try {
      await api.post('/auth/send-code', { phone })
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timer); return 0 }
          return c - 1
        })
      }, 1000)
    } catch (err: any) {
      setError(err.response?.data?.message || '发送验证码失败，请稍后重试')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!phone) { setError('请输入手机号'); return }
    if (!code) { setError('请输入验证码'); return }
    if (!password) { setError('请设置密码'); return }
    if (password.length < 6) { setError('密码至少6位'); return }
    if (password !== confirmPassword) { setError('两次密码不一致'); return }

    setLoading(true)
    try {
      const res = await api.post('/auth/register', { phone, code, password })
      const { access_token: token, user } = res.data.data || res.data
      setAuth(token, user)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-900">注册</h1>
        <p className="mt-2 text-center text-sm text-gray-500">创建账号，开启公考面试备考之旅</p>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">手机号</label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">验证码</label>
            <div className="mt-1 flex gap-2">
              <Input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="请输入验证码"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleSendCode}
                disabled={countdown > 0 || !phone}
                className="shrink-0 whitespace-nowrap"
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">密码</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请设置密码（至少6位）"
              className="mt-1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">确认密码</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              className="mt-1"
            />
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? '注册中...' : '注册'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          已有账号？
          <Link to="/login" className="text-primary hover:underline ml-1">立即登录</Link>
        </p>
      </div>
    </div>
  )
}
