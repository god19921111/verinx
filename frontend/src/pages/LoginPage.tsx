import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [tab, setTab] = useState<'code' | 'password'>('code')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
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

    setLoading(true)
    try {
      let res: any
      if (tab === 'code') {
        if (!code) { setError('请输入验证码'); setLoading(false); return }
        res = await api.post('/auth/login-code', { phone, code })
      } else {
        if (!password) { setError('请输入密码'); setLoading(false); return }
        res = await api.post('/auth/login-password', { phone, password })
      }
      const { access_token: token, user } = res.data.data || res.data
      setAuth(token, user)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败，请检查输入')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/quick-login')
      const { access_token: token, user } = res.data.data || res.data
      setAuth(token, user)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || '快速登录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-128px)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.3em] mb-6 text-center">
          SECURE ACCESS
        </div>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight text-center">
          登 录
        </h1>
        <p className="mt-4 text-center text-sm text-[rgba(240,240,250,0.5)] font-body">
          登录后即可开始面试练习
        </p>

        <div className="mt-10 border-t border-[rgba(240,240,250,0.35)] w-16 mx-auto" />

        <button
          type="button"
          className="w-full mt-10 border border-[#F0F0FA] px-8 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex disabled:opacity-50"
          onClick={handleQuickLogin}
          disabled={loading}
        >
          <span className="text-xs uppercase-spacex tracking-[0.15em]">
            {loading ? '登录中...' : 'VIP 体验账号 · 一键登录'}
          </span>
        </button>

        <div className="flex items-center gap-4 my-10">
          <div className="flex-1 h-px bg-[rgba(240,240,250,0.2)]" />
          <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
            或使用手机号登录
          </span>
          <div className="flex-1 h-px bg-[rgba(240,240,250,0.2)]" />
        </div>

        <div className="flex">
          <button
            type="button"
            className={`flex-1 pb-3 text-xs uppercase-spacex tracking-[0.15em] border-b transition-spacex ${
              tab === 'code' 
                ? 'border-[#F0F0FA] text-[#F0F0FA]' 
                : 'border-[rgba(240,240,250,0.2)] text-[#808080] hover:text-[rgba(240,240,250,0.7)]'
            }`}
            onClick={() => { setTab('code'); setError('') }}
          >
            验证码登录
          </button>
          <button
            type="button"
            className={`flex-1 pb-3 text-xs uppercase-spacex tracking-[0.15em] border-b transition-spacex ${
              tab === 'password' 
                ? 'border-[#F0F0FA] text-[#F0F0FA]' 
                : 'border-[rgba(240,240,250,0.2)] text-[#808080] hover:text-[rgba(240,240,250,0.7)]'
            }`}
            onClick={() => { setTab('password'); setError('') }}
          >
            密码登录
          </button>
        </div>

        {error && (
          <div className="mt-6 border border-[rgba(239,68,68,0.5)] p-3">
            <span className="text-xs uppercase-spacex tracking-[0.1em] text-[rgba(239,68,68,0.9)]">
              {error}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className="block text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-3">
              手机号
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              className="w-full bg-transparent border border-[rgba(240,240,250,0.35)] px-4 py-3 text-[#F0F0FA] font-body placeholder:text-[#808080] focus:border-[#F0F0FA] focus:outline-none transition-spacex"
            />
          </div>

          {tab === 'code' ? (
            <div>
              <label className="block text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-3">
                验证码
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入验证码"
                  className="flex-1 bg-transparent border border-[rgba(240,240,250,0.35)] px-4 py-3 text-[#F0F0FA] font-body placeholder:text-[#808080] focus:border-[#F0F0FA] focus:outline-none transition-spacex"
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || !phone}
                  className="shrink-0 border border-[rgba(240,240,250,0.35)] px-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex disabled:opacity-50"
                >
                  <span className="text-xs uppercase-spacex tracking-[0.1em] text-[#F0F0FA]">
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-3">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full bg-transparent border border-[rgba(240,240,250,0.35)] px-4 py-3 text-[#F0F0FA] font-body placeholder:text-[#808080] focus:border-[#F0F0FA] focus:outline-none transition-spacex"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full border border-[rgba(240,240,250,0.35)] px-8 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex disabled:opacity-50"
          >
            <span className="text-xs uppercase-spacex tracking-[0.15em]">
              {loading ? '登录中...' : '登录'}
            </span>
          </button>
        </form>

        <div className="mt-10 text-center">
          <span className="text-xs uppercase-spacex tracking-[0.1em] text-[#808080]">
            还没有账号？
          </span>
          <Link to="/register" className="ml-3 text-xs uppercase-spacex tracking-[0.1em] text-[#F0F0FA] hover:underline transition-spacex">
            立即注册
          </Link>
        </div>
      </div>
    </div>
  )
}
