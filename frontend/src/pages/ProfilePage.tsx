import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import type { User, PracticeRecord } from '@/types'

export function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [recentRecords, setRecentRecords] = useState<PracticeRecord[]>([])

  // Fetch user info
  useEffect(() => {
    setLoading(true)
    api.get('/user/info')
      .then((res) => {
        const data = res.data.data || res.data
        updateUser(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [updateUser])

  // Fetch recent practice records
  useEffect(() => {
    api.get('/practice', { params: { page: 1, page_size: 5 } })
      .then((res) => {
        const data = res.data.data || res.data
        setRecentRecords(data.items || data.list || [])
      })
      .catch(() => setRecentRecords([]))
  }, [])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-primary">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M19 8v2M19 12h2" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-gray-900 truncate">
                  {user?.name || '用户'}
                </h1>
                {user?.member_type === 'premium' ? (
                  <Badge variant="warning">付费会员</Badge>
                ) : (
                  <Badge variant="default">免费用户</Badge>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') || '未登录'}
              </div>
            </div>
            {user?.member_type === 'free' && (
              <Link to="/membership">
                <Button variant="primary" size="sm">开通会员</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Practice Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <div className="text-sm text-gray-500">练习总次数</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {user?.total_practice_count ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="text-sm text-gray-500">平均得分</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {user?.avg_score?.toFixed(1) ?? '0.0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent History */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">最近练习</h2>
          <Link to="/history" className="text-sm text-primary hover:underline">查看全部</Link>
        </div>
        <div className="mt-3 space-y-3">
          {recentRecords.length === 0 && (
            <div className="py-8 text-center text-gray-400">暂无练习记录</div>
          )}
          {recentRecords.map((r) => (
            <Link key={r.id} to={`/report/${r.id}`}>
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-400">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {r.question?.category ?? '练习'}
                        </div>
                        <div className="text-xs text-gray-400">{formatDate(r.created_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={r.practice_mode === 'full' ? 'warning' : 'success'}>
                        {r.practice_mode === 'full' ? '全真模拟' : '专项训练'}
                      </Badge>
                      <span className="text-sm font-semibold text-gray-900">
                        {r.score_overall ?? '-'}分
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
