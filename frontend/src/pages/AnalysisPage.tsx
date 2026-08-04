import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import api from '@/lib/api'

interface DashboardData {
  total_practiced: number
  radar: {
    analysis: number
    expression: number
    adaptability: number
    organization: number
  }
  trend: { date: string; score: number; category: string }[]
  weakness: {
    dimension: string
    dimension_score: number
    category: string
    category_score: number
    suggestion: string
  }
  stats: {
    avg_score: number
    best_score: number
    this_week_count: number
    streak_days: number
  }
  category_stats: Record<string, { count: number; avg_score: number; best_score: number }>
}

interface RecommendData {
  ready: boolean
  message?: string
  weakest_category?: string
  weakest_dimension?: string
  recommendations: {
    type: string
    category: string
    reason: string
    difficulty: number
  }[]
}

export function AnalysisPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [recommend, setRecommend] = useState<RecommendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/stats/dashboard').then(r => r.data.data || r.data).catch(() => null),
      api.get('/stats/recommend').then(r => r.data.data || r.data).catch(() => null),
    ]).then(([d, r]) => {
      setDashboard(d)
      setRecommend(r)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-48 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (!dashboard || dashboard.total_practiced === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mb-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-12 h-12 text-[rgba(240,240,250,0.4)]">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
                <path d="M15 21v-6" />
                <path d="M12 21v-3" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">暂无分析数据</h2>
            <p className="text-sm text-gray-500 mb-6">完成首次练习后即可获得能力分析和个性化推荐</p>
            <Link to="/practice/full" className="inline-flex items-center px-6 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50">
              开始练习
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const radarData = [
    { label: '综合分析', value: dashboard.radar.analysis, color: '#3b82f6' },
    { label: '言语表达', value: dashboard.radar.expression, color: '#10b981' },
    { label: '应变能力', value: dashboard.radar.adaptability, color: '#f59e0b' },
    { label: '计划组织', value: dashboard.radar.organization, color: '#8b5cf6' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">能力分析</h1>
        <p className="text-sm text-gray-500 mt-1">基于{dashboard.total_practiced}次练习数据生成</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '平均分', value: dashboard.stats.avg_score, suffix: '分' },
          { label: '最高分', value: dashboard.stats.best_score, suffix: '分' },
          { label: '本周练习', value: dashboard.stats.this_week_count, suffix: '次' },
          { label: '连续天数', value: dashboard.stats.streak_days, suffix: '天' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="py-3 text-center">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {s.value}<span className="text-xs font-normal text-gray-400 ml-0.5">{s.suffix}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 能力雷达图（纯CSS实现） */}
      <Card>
        <CardContent className="py-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">四维能力雷达图</h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* 雷达图 */}
            <div className="relative w-64 h-64 flex-shrink-0">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* 网格圆 */}
                {[25, 50, 75, 100].map((r) => (
                  <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#e5e7eb" strokeWidth="1" />
                ))}
                {/* 轴线 */}
                {radarData.map((_, i) => {
                  const angle = (i * 90 - 90) * (Math.PI / 180)
                  const x2 = 100 + 100 * Math.cos(angle)
                  const y2 = 100 + 100 * Math.sin(angle)
                  return <line key={i} x1="100" y1="100" x2={x2} y2={y2} stroke="#e5e7eb" strokeWidth="1" />
                })}
                {/* 数据区域 */}
                <polygon
                  points={radarData.map((d, i) => {
                    const angle = (i * 90 - 90) * (Math.PI / 180)
                    const r = (d.value / 100) * 100
                    return `${100 + r * Math.cos(angle)},${100 + r * Math.sin(angle)}`
                  }).join(' ')}
                  fill="rgba(59,130,246,0.15)"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
                {/* 数据点 */}
                {radarData.map((d, i) => {
                  const angle = (i * 90 - 90) * (Math.PI / 180)
                  const r = (d.value / 100) * 100
                  return (
                    <circle
                      key={i}
                      cx={100 + r * Math.cos(angle)}
                      cy={100 + r * Math.sin(angle)}
                      r="3"
                      fill={d.color}
                    />
                  )
                })}
                {/* 标签 */}
                {radarData.map((d, i) => {
                  const angle = (i * 90 - 90) * (Math.PI / 180)
                  const lx = 100 + 115 * Math.cos(angle)
                  const ly = 100 + 115 * Math.sin(angle)
                  return (
                    <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-gray-600">
                      {d.label}
                    </text>
                  )
                })}
              </svg>
            </div>
            {/* 分数列表 */}
            <div className="flex-1 w-full space-y-2">
              {radarData.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded" style={{ backgroundColor: d.color }} />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">{d.label}</div>
                    <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${d.value}%`, backgroundColor: d.color }} />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 w-12 text-right">{d.value}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 进步趋势 */}
      {dashboard.trend.length > 1 && (
        <Card>
          <CardContent className="py-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">分数趋势</h2>
            <div className="relative h-48">
              <svg viewBox={`0 0 ${Math.max(300, dashboard.trend.length * 30)} 180`} className="w-full h-full" preserveAspectRatio="none">
                {/* Y轴网格线 */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <g key={y}>
                    <line x1="0" y1={180 - y * 1.6} x2="100%" y2={180 - y * 1.6} stroke="#f3f4f6" strokeWidth="1" />
                    <text x="0" y={180 - y * 1.6 - 3} className="text-[9px] fill-gray-400">{y}</text>
                  </g>
                ))}
                {/* 折线 */}
                <polyline
                  points={dashboard.trend.map((p, i) => `${i * 30 + 20},${180 - p.score * 1.6}`).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
                {/* 数据点 */}
                {dashboard.trend.map((p, i) => (
                  <g key={i}>
                    <circle cx={i * 30 + 20} cy={180 - p.score * 1.6} r="3" fill="#3b82f6" />
                    {i === dashboard.trend!.length - 1 && (
                      <text x={i * 30 + 20} y={180 - p.score * 1.6 - 8} textAnchor="middle" className="text-[10px] fill-blue-600 font-bold">
                        {p.score}
                      </text>
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 薄弱项分析 */}
      <Card>
        <CardContent className="py-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">薄弱项分析</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-500">最弱维度</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{dashboard.weakness.dimension}</div>
              </div>
              <div className="text-2xl font-bold text-red-500">{dashboard.weakness.dimension_score}</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-500">最弱题型</div>
                <div className="text-sm font-semibold text-gray-900 mt-0.5">{dashboard.weakness.category}</div>
              </div>
              <div className="text-2xl font-bold text-orange-500">{dashboard.weakness.category_score}</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-600 font-medium mb-1">提升建议</div>
              <div className="text-sm text-gray-700">{dashboard.weakness.suggestion}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 智能推荐 */}
      {recommend && recommend.ready && recommend.recommendations.length > 0 && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">智能推荐练习</h2>
              <Badge variant="warning">个性化</Badge>
            </div>
            <div className="space-y-3">
              {recommend.recommendations.map((rec, i) => (
                <Link
                  key={i}
                  to={`/practice/single?category=${encodeURIComponent(rec.category)}&difficulty=${rec.difficulty}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900">{rec.category}</span>
                    <Badge variant="default">{'⭐'.repeat(rec.difficulty)}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">{rec.reason}</p>
                  <div className="mt-2 text-xs text-blue-600 font-medium">去练习 →</div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 题型统计 */}
      {Object.keys(dashboard.category_stats).length > 0 && (
        <Card>
          <CardContent className="py-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">题型统计</h2>
            <div className="space-y-2">
              {Object.entries(dashboard.category_stats).map(([cat, s]) => (
                <div key={cat} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700">{cat}</span>
                    <Badge variant="default">{s.count}次</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">平均 <span className="font-semibold text-gray-900">{s.avg_score}</span></span>
                    <span className="text-gray-500">最高 <span className="font-semibold text-green-600">{s.best_score}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
