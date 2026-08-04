import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'

interface LowScoreItem {
  practice_id: string
  question_id: string
  question_content: string
  question_category: string
  score_overall: number
  score_analysis: number
  score_expression: number
  score_adaptability: number
  score_organization: number
  created_at: string
  report_content: string
  deduction_points: string
  optimization_suggestions: string
}

interface WeaknessData {
  ready: boolean
  message?: string
  weakness: {
    dimension: string
    dimension_score: number
    category: string
    category_score: number
    suggestion: string
  }
  low_scores: LowScoreItem[]
  category_stats: Record<string, { count: number; avg_score: number; best_score: number }>
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-[#F0F0FA]'
  if (score >= 60) return 'text-[rgba(240,240,250,0.8)]'
  return 'text-[rgba(239,68,68,0.9)]'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return '稳了'
  if (score >= 70) return '有料'
  if (score >= 60) return '凑合'
  return '翻车'
}

export function WeaknessPage() {
  const [data, setData] = useState<WeaknessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    api.get('/stats/weakness-detail')
      .then((res) => {
        const d = res.data.data || res.data
        setData(d)
      })
      .catch(() => setData({ ready: false, message: '数据加载失败', weakness: { dimension: '', dimension_score: 0, category: '', category_score: 0, suggestion: '' }, low_scores: [], category_stats: {} }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="border border-[rgba(240,240,250,0.35)] p-16 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="w-3 h-3 bg-[#F0F0FA] animate-pulse" />
            <div className="w-3 h-3 bg-[rgba(240,240,250,0.5)] animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-3 h-3 bg-[rgba(240,240,250,0.3)] animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <p className="mt-4 text-sm text-[#808080]">VERINX 正在翻你的旧账...</p>
        </div>
      </div>
    )
  }

  if (!data || !data.ready) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="border border-[rgba(240,240,250,0.35)] p-16 text-center">
          <p className="text-[rgba(240,240,250,0.7)] font-body">
            {data?.message || '完成练习后即可查看薄弱项'}
          </p>
          <Link
            to="/practice/full"
            className="inline-block mt-6 border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex"
          >
            <span className="text-xs uppercase-spacex tracking-[0.15em]">去练习</span>
          </Link>
        </div>
      </div>
    )
  }

  const w = data.weakness

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* 标题 */}
      <div className="mb-8">
        <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.2em] mb-2">
          WEAKNESS REVIEW
        </div>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">
          薄弱项复习
        </h1>
      </div>

      {/* 薄弱项总览 */}
      <div className="border border-[rgba(240,240,250,0.35)] p-6 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-2 h-2 bg-[#F0F0FA] animate-pulse" />
          <span className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080]">
            VERINX 诊断
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="border border-[rgba(240,240,250,0.2)] p-4">
            <div className="text-xs uppercase-spacex tracking-[0.1em] text-[#808080] mb-2">
              最弱维度
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg text-[rgba(240,240,250,0.9)] font-body">{w.dimension}</span>
              <span className={`text-3xl font-bold tabular-nums ${getScoreColor(w.dimension_score)}`}>
                {w.dimension_score}
              </span>
            </div>
          </div>
          <div className="border border-[rgba(240,240,250,0.2)] p-4">
            <div className="text-xs uppercase-spacex tracking-[0.1em] text-[#808080] mb-2">
              最弱题型
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg text-[rgba(240,240,250,0.9)] font-body">{w.category}</span>
              <span className={`text-3xl font-bold tabular-nums ${getScoreColor(w.category_score)}`}>
                {w.category_score}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-[rgba(240,240,250,0.2)] p-4">
          <div className="text-xs uppercase-spacex tracking-[0.1em] text-[#808080] mb-2">
            VERINX 说
          </div>
          <p className="text-[rgba(240,240,250,0.85)] font-body leading-relaxed">
            {w.dimension_score < 60
              ? `你的${w.dimension}只有${w.dimension_score}分，这是硬伤了。下面列了你翻车的题，逐条看完"怎么改"再重练。`
              : w.dimension_score < 70
              ? `${w.dimension}平均${w.dimension_score}分，刚过线但不够稳。重点盯紧下面这几道低分题。`
              : `${w.dimension}已经${w.dimension_score}分了，不错。但${w.category}还有提升空间，继续刷。`}
          </p>
        </div>
      </div>

      {/* 题型统计 */}
      {Object.keys(data.category_stats).length > 0 && (
        <div className="border border-[rgba(240,240,250,0.35)] p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-4 bg-[#F0F0FA]" />
            <span className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080]">
              题型统计
            </span>
          </div>
          <div className="space-y-3">
            {Object.entries(data.category_stats).map(([cat, s]) => (
              <div key={cat} className="flex items-center justify-between py-3 border-b border-[rgba(240,240,250,0.15)] last:border-0">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[rgba(240,240,250,0.85)]">{cat}</span>
                  <span className="text-[10px] uppercase-spacex text-[#808080]">{s.count} 次</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-[#808080]">
                    均 <span className={`font-bold ${getScoreColor(s.avg_score)}`}>{s.avg_score}</span>
                  </span>
                  <span className="text-[#808080]">
                    最高 <span className="font-bold text-[#F0F0FA]">{s.best_score}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 翻车题列表 */}
      <div className="border border-[rgba(240,240,250,0.35)]">
        <div className="border-b border-[rgba(240,240,250,0.35)] p-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 bg-[rgba(239,68,68,0.9)]" />
            <span className="text-xs uppercase-spacex tracking-[0.2em] text-[rgba(239,68,68,0.9)]">
              翻车题 · 共 {data.low_scores.length} 道
            </span>
          </div>
        </div>

        <div className="divide-y divide-[rgba(240,240,250,0.15)]">
          {data.low_scores.map((item) => (
            <div key={item.practice_id} className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] uppercase-spacex text-[#808080]">{item.question_category}</span>
                    <span className="text-[10px] uppercase-spacex text-[rgba(240,240,250,0.5)]">{item.created_at}</span>
                  </div>
                  <p className="text-sm text-[rgba(240,240,250,0.85)] font-body leading-relaxed line-clamp-2">
                    {item.question_content}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-3xl font-bold tabular-nums ${getScoreColor(item.score_overall)}`}>
                    {item.score_overall}
                  </div>
                  <div className="text-[10px] uppercase-spacex text-[#808080] mt-1">
                    {getScoreLabel(item.score_overall)}
                  </div>
                </div>
              </div>

              {/* 四维小条 */}
              <div className="flex items-center gap-4 mb-4 text-[10px] uppercase-spacex text-[#808080]">
                <span>综 {item.score_analysis}</span>
                <span>表 {item.score_expression}</span>
                <span>应 {item.score_adaptability}</span>
                <span>组 {item.score_organization}</span>
              </div>

              {/* 展开详情 */}
              {expandedId === item.practice_id && (
                <div className="mb-4 space-y-3 border border-[rgba(240,240,250,0.15)] p-4">
                  {item.deduction_points && (
                    <div>
                      <div className="text-[10px] uppercase-spacex text-[rgba(239,68,68,0.9)] mb-1">上次硬伤</div>
                      <p className="text-sm text-[rgba(240,240,250,0.7)] font-body">{item.deduction_points}</p>
                    </div>
                  )}
                  {item.optimization_suggestions && (
                    <div>
                      <div className="text-[10px] uppercase-spacex text-[#F0F0FA] mb-1">怎么改</div>
                      <p className="text-sm text-[rgba(240,240,250,0.7)] font-body">{item.optimization_suggestions}</p>
                    </div>
                  )}
                  {item.report_content && (
                    <div>
                      <div className="text-[10px] uppercase-spacex text-[#808080] mb-1">总评</div>
                      <p className="text-sm text-[rgba(240,240,250,0.7)] font-body">{item.report_content}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  className="border border-[rgba(240,240,250,0.2)] px-6 py-2 hover:bg-[rgba(240,240,250,0.05)] transition-spacex"
                  onClick={() => setExpandedId(expandedId === item.practice_id ? null : item.practice_id)}
                >
                  <span className="text-[10px] uppercase-spacex tracking-[0.15em] text-[#808080]">
                    {expandedId === item.practice_id ? '收起' : '查看详情'}
                  </span>
                </button>
                <Link
                  to={`/practice/full?content=${encodeURIComponent(item.question_content)}&category=${encodeURIComponent(item.question_category)}&ref=weakness`}
                  className="border border-[rgba(240,240,250,0.35)] px-6 py-2 hover:bg-[rgba(240,240,250,0.1)] transition-spacex"
                >
                  <span className="text-[10px] uppercase-spacex tracking-[0.15em]">
                    重练这道题 →
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
