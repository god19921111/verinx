import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '@/lib/api'
import type { PracticeRecord } from '@/types'

type ScoreFilter = 'all' | 'lt60' | '60-80' | 'gt80'
type ModeFilter = 'all' | 'single' | 'full' | 'checkin' | 'challenge'

const CATEGORIES = ['综合分析', '人际沟通', '应急应变', '组织管理', '自我认知']

export function HistoryPage() {
  const { isAuthenticated, user } = useAuthStore()
  const [records, setRecords] = useState<PracticeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    const params: Record<string, string> = {
      page: String(page),
      page_size: '10',
    }
    if (modeFilter === 'single') params.practice_mode = 'single'
    if (modeFilter === 'full') params.practice_mode = 'full'

    api.get('/practice', { params })
      .then((res) => {
        const data = res.data.data || res.data
        let items = data.items || data.list || []

        if (categoryFilter !== 'all') {
          items = items.filter((r: PracticeRecord) => r.question?.category === categoryFilter)
        }
        if (scoreFilter === 'lt60') {
          items = items.filter((r: PracticeRecord) => (r.score_overall ?? 0) < 60)
        } else if (scoreFilter === '60-80') {
          items = items.filter((r: PracticeRecord) => {
            const s = r.score_overall ?? 0
            return s >= 60 && s < 80
          })
        } else if (scoreFilter === 'gt80') {
          items = items.filter((r: PracticeRecord) => (r.score_overall ?? 0) >= 80)
        }

        setRecords(items)
        setTotalPages(data.total_pages || Math.ceil((data.total || 0) / 10) || 1)
      })
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [isAuthenticated, modeFilter, categoryFilter, scoreFilter, page])

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'full': return '全真模拟'
      case 'single': return '专项训练'
      default: return mode
    }
  }

  const getModeBadge = (mode: string) => {
    const modeMap: Record<string, { label: string; color: string }> = {
      single: { label: '专项训练', color: 'text-[rgba(34,197,94,0.8)] border-[rgba(34,197,94,0.35)]' },
      full: { label: '全真模拟', color: 'text-[rgba(249,115,22,0.8)] border-[rgba(249,115,22,0.35)]' },
      checkin: { label: '每日打卡', color: 'text-[rgba(255,215,0,0.8)] border-[rgba(255,215,0,0.35)]' },
      challenge: { label: '极限试炼', color: 'text-[rgba(239,68,68,0.8)] border-[rgba(239,68,68,0.35)]' },
    }
    return modeMap[mode] || { label: mode, color: 'text-[#808080] border-[rgba(240,240,250,0.2)]' }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const getScoreLevel = (score: number) => {
    if (score >= 80) return { label: '稳了', color: 'text-[rgba(34,197,94,0.9)]' }
    if (score >= 70) return { label: '有料', color: 'text-[rgba(249,115,22,0.9)]' }
    if (score >= 60) return { label: '凑合', color: 'text-[rgba(234,179,8,0.9)]' }
    return { label: '得练', color: 'text-[rgba(239,68,68,0.9)]' }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.2em] mb-2">
          PRACTICE RECORDS
        </div>
        <h1 className="font-display text-3xl tracking-tight">答题记录</h1>
        <p className="mt-2 text-sm text-[rgba(240,240,250,0.6)] font-body">
          点击记录展开详情，或再次挑战同一道题
        </p>
      </div>

      {/* 筛选栏 */}
      <div className="border border-[rgba(240,240,250,0.2)] p-4 mb-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase-spacex text-[#808080]">模式</span>
            {(['all', 'single', 'full'] as ModeFilter[]).map(f => (
              <button
                key={f}
                onClick={() => { setModeFilter(f); setPage(1) }}
                className={`text-xs uppercase-spacex px-3 py-1 border transition-spacex ${
                  modeFilter === f
                    ? 'border-[rgba(240,240,250,0.5)] text-[#F0F0FA]'
                    : 'border-[rgba(240,240,250,0.15)] text-[#808080] hover:text-[#F0F0FA]'
                }`}
              >
                {f === 'all' ? '全部' : getModeLabel(f)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase-spacex text-[#808080]">题型</span>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
              className="bg-transparent border border-[rgba(240,240,250,0.2)] text-[#F0F0FA] text-xs px-2 py-1 focus:outline-none focus:border-[rgba(240,240,250,0.5)]"
            >
              <option value="all" className="bg-[#0a0a0a]">全部</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c} className="bg-[#0a0a0a]">{c}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase-spacex text-[#808080]">分数</span>
            {([
              { key: 'all' as ScoreFilter, label: '全部' },
              { key: 'lt60' as ScoreFilter, label: '<60' },
              { key: '60-80' as ScoreFilter, label: '60-80' },
              { key: 'gt80' as ScoreFilter, label: '80+' },
            ]).map(f => (
              <button
                key={f.key}
                onClick={() => { setScoreFilter(f.key); setPage(1) }}
                className={`text-xs uppercase-spacex px-3 py-1 border transition-spacex ${
                  scoreFilter === f.key
                    ? 'border-[rgba(240,240,250,0.5)] text-[#F0F0FA]'
                    : 'border-[rgba(240,240,250,0.15)] text-[#808080] hover:text-[#F0F0FA]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>


        </div>
      </div>

      {/* 记录列表 */}
      <div className="space-y-3">
        {loading && (
          <div className="py-12 text-center text-[#808080] text-sm">加载中...</div>
        )}
        {!loading && records.length === 0 && (
          <div className="py-12 text-center text-[#808080]">
            暂无练习记录
          </div>
        )}
        {!loading && records.map((r) => {
          const modeInfo = getModeBadge(r.practice_mode)
          const score = r.score_overall ?? 0
          const level = getScoreLevel(score)
          const isExpanded = expandedId === r.id

          return (
            <div
              key={r.id}
              className={`border transition-spacex ${
                isExpanded ? 'border-[rgba(240,240,250,0.5)]' : 'border-[rgba(240,240,250,0.2)]'
              }`}
            >
              <div
                className="p-4 cursor-pointer hover:bg-[rgba(240,240,250,0.02)]"
                onClick={() => toggleExpand(r.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col items-center text-center shrink-0 w-14">
                      <div className="font-display text-2xl tabular-nums text-[#F0F0FA]">
                        {score}
                      </div>
                      <div className={`text-[10px] uppercase-spacex ${level.color}`}>
                        {level.label}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {r.question?.category && (
                          <span className="text-[10px] uppercase-spacex tracking-[0.1em] text-[#808080]">
                            {r.question.category}
                          </span>
                        )}
                        <span className={`text-[10px] uppercase-spacex tracking-[0.1em] border px-1.5 py-0.5 ${modeInfo.color}`}>
                          {modeInfo.label}
                        </span>
                      </div>
                      <p className="text-sm text-[rgba(240,240,250,0.8)] font-body line-clamp-1">
                        {r.question?.content || '题目加载中...'}
                      </p>
                      <div className="mt-1 text-[10px] uppercase-spacex tracking-[0.1em] text-[#808080]">
                        {formatDate(r.created_at)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[#808080] text-sm">{isExpanded ? '收起 ▲' : '展开 ▼'}</span>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[rgba(240,240,250,0.2)] p-6 space-y-4">
                  {r.question && (
                    <div>
                      <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">
                        题目
                      </div>
                      <p className="text-[rgba(240,240,250,0.9)] font-body leading-relaxed">
                        {r.question.content}
                      </p>
                    </div>
                  )}

                  {r.answer_text && (
                    <div>
                      <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">
                        我的作答
                      </div>
                      <p className="text-sm text-[rgba(240,240,250,0.8)] font-body leading-relaxed whitespace-pre-line">
                        {r.answer_text}
                      </p>
                    </div>
                  )}

                  {r.report_content && (
                    <div>
                      <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">
                        AI点评
                      </div>
                      <p className="text-sm text-[rgba(240,240,250,0.8)] font-body leading-relaxed">
                        {r.report_content}
                      </p>
                    </div>
                  )}

                  {/* 四维分数 */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: '综合分析', score: r.score_analysis },
                      { label: '言语表达', score: r.score_expression },
                      { label: '应急应变', score: r.score_adaptability },
                      { label: '组织管理', score: r.score_organization },
                    ].map(d => (
                      <div key={d.label} className="border border-[rgba(240,240,250,0.15)] p-3 text-center">
                        <div className="text-[10px] uppercase-spacex tracking-[0.1em] text-[#808080] mb-1">
                          {d.label}
                        </div>
                        <div className="font-display text-xl tabular-nums text-[#F0F0FA]">
                          {d.score ?? '-'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {r.deduction_points && (
                    <div>
                      <div className="text-xs uppercase-spacex tracking-[0.15em] text-[rgba(239,68,68,0.8)] mb-2">
                        硬伤
                      </div>
                      <p className="text-sm text-[rgba(240,240,250,0.7)] font-body">
                        {r.deduction_points}
                      </p>
                    </div>
                  )}

                  {r.optimization_suggestions && (
                    <div>
                      <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#F0F0FA] mb-2">
                        怎么改
                      </div>
                      <p className="text-sm text-[rgba(240,240,250,0.7)] font-body">
                        {r.optimization_suggestions}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    {r.question_id && (
                      <Link
                        to={`/checkin?retry=${r.question_id}`}
                        className="border border-[rgba(240,240,250,0.35)] px-6 py-3 text-center hover:bg-[rgba(240,240,250,0.1)] transition-spacex"
                      >
                        <span className="text-xs uppercase-spacex tracking-[0.15em]">
                          再次挑战本题
                        </span>
                      </Link>
                    )}
                    <Link
                      to={`/report/${r.id}`}
                      className="border border-[rgba(240,240,250,0.15)] px-6 py-3 text-center hover:bg-[rgba(240,240,250,0.05)] transition-spacex"
                    >
                      <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
                        查看完整报告
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="border border-[rgba(240,240,250,0.2)] px-4 py-2 text-xs uppercase-spacex text-[#808080] hover:text-[#F0F0FA] transition-spacex disabled:opacity-30"
          >
            上一页
          </button>
          <span className="text-xs text-[#808080]">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="border border-[rgba(240,240,250,0.2)] px-4 py-2 text-xs uppercase-spacex text-[#808080] hover:text-[#F0F0FA] transition-spacex disabled:opacity-30"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
