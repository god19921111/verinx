import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import type { HeatmapData, RankData } from '@/types'

const LEVEL_COLORS: Record<string, string> = {
  'STAGE-01': '#ef4444',
  'STAGE-02': '#f97316',
  'STAGE-03': '#eab308',
  'STAGE-04': '#22c55e',
  'STAGE-05': '#3b82f6',
}

const LEVEL_NAMES: Record<string, string> = {
  'STAGE-01': '新手',
  'STAGE-02': '入门',
  'STAGE-03': '熟练',
  'STAGE-04': '精通',
  'STAGE-05': '大师',
}

export function ProgressPage() {
  const [heatmap, setHeatmap] = useState<HeatmapData[]>([])
  const [rank, setRank] = useState<RankData | null>(null)
  const [heatmapSummary, setHeatmapSummary] = useState({
    days: 90,
    total_active_days: 0,
    total_practices: 0,
    avg_daily_practices: 0,
    max_streak_days: 0,
  })
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<HeatmapData | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get('/stats/heatmap', { params: { days: 90 } }).then(r => r.data.data || r.data).catch(() => null),
      api.get('/stats/rank').then(r => r.data.data || r.data).catch(() => null),
    ]).then(([h, r]) => {
      if (h) {
        setHeatmap(h.heatmap || [])
        setHeatmapSummary({
          days: h.days || 90,
          total_active_days: h.total_active_days || 0,
          total_practices: h.total_practices || 0,
          avg_daily_practices: h.avg_daily_practices || 0,
          max_streak_days: h.max_streak_days || 0,
        })
      }
      if (r) setRank(r)
      setLoading(false)
    })
  }, [])

  const maxCount = useMemo(() => {
    if (heatmap.length === 0) return 1
    return Math.max(...heatmap.map(d => d.count), 1)
  }, [heatmap])

  const heatmapWeeks = useMemo(() => {
    const weeks: HeatmapData[][] = []
    let week: HeatmapData[] = []
    const firstDay = heatmap[0]
    if (!firstDay) return []

    const firstDate = new Date(firstDay.date)
    const startDow = firstDate.getDay()

    for (let i = 0; i < startDow; i++) {
      week.push({ date: '', count: -1, avg_score: 0, level: -1 })
    }

    for (const day of heatmap) {
      week.push(day)
      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }
    if (week.length > 0) {
      while (week.length < 7) {
        week.push({ date: '', count: -1, avg_score: 0, level: -1 })
      }
      weeks.push(week)
    }
    return weeks
  }, [heatmap])

  const todayData = useMemo(() => {
    if (heatmap.length === 0) return null
    return heatmap[heatmap.length - 1]
  }, [heatmap])

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* 标题 */}
      <div className="mb-12">
        <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.3em] mb-2">
          PROGRESS TRACKING
        </div>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">
          进度追踪
        </h1>
        <p className="mt-2 text-sm text-[rgba(240,240,250,0.6)] font-body">
          每一次练习都在塑造你的段位
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[#808080] text-xs uppercase-spacex tracking-[0.2em]">
          加载中...
        </div>
      ) : (
        <>
          {/* 段位系统 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {/* 当前段位 */}
            <div className="lg:col-span-1 border border-[rgba(240,240,250,0.35)] p-6">
              <div className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080] mb-4">
                当前段位
              </div>
              {rank ? (
                <>
                  <div className="flex items-center gap-4 mb-6">
                    <div
                      className="w-16 h-16 flex items-center justify-center border-2"
                      style={{
                        borderColor: rank.level.color,
                        boxShadow: `0 0 24px ${rank.level.color}40`,
                      }}
                    >
                      <span
                        className="font-display text-lg"
                        style={{ color: rank.level.color }}
                      >
                        {rank.level.level.split('-')[1]}
                      </span>
                    </div>
                    <div>
                      <div className="font-display text-2xl text-[#F0F0FA]">
                        {rank.level.label}
                      </div>
                      <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.15em]">
                        {rank.level.level}
                      </div>
                    </div>
                  </div>

                  {/* 段位分数 */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-display text-4xl tabular-nums text-[#F0F0FA]">
                        {rank.rank_score}
                      </span>
                      <span className="text-xs text-[#808080]">分</span>
                    </div>
                    <div className="mt-1 text-xs text-[rgba(240,240,250,0.5)] font-body">
                      段位分 = 历史均分×40% + 近30天均分×30% + 练习量×30%
                    </div>
                  </div>

                  {/* 进度条 */}
                  {rank.next_level && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
                          距离 {rank.next_level.label}
                        </span>
                        <span className="text-xs tabular-nums text-[rgba(240,240,250,0.7)]">
                          {rank.progress_percent}%
                        </span>
                      </div>
                      <div className="h-1 bg-[rgba(240,240,250,0.1)] overflow-hidden">
                        <div
                          className="h-full transition-all duration-1000"
                          style={{
                            width: `${rank.progress_percent}%`,
                            backgroundColor: rank.next_level.color,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[#808080] text-sm">暂无数据</div>
              )}
            </div>

            {/* 段位阶梯 */}
            <div className="lg:col-span-2 border border-[rgba(240,240,250,0.35)] p-6">
              <div className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080] mb-4">
                段位阶梯
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(['STAGE-01', 'STAGE-02', 'STAGE-03', 'STAGE-04', 'STAGE-05'] as const).map((stage, i) => {
                  const isCurrent = rank?.level.level === stage
                  const isPassed = rank ? rank.rank_score >= [60, 70, 80, 90, 100][i] : false
                  return (
                    <div
                      key={stage}
                      className={`border p-3 text-center transition-spacex ${
                        isCurrent
                          ? 'border-[rgba(240,240,250,0.6)] bg-[rgba(240,240,250,0.05)]'
                          : isPassed
                          ? 'border-[rgba(240,240,250,0.2)]'
                          : 'border-[rgba(240,240,250,0.1)]'
                      }`}
                    >
                      <div
                        className="font-display text-xl mb-1"
                        style={{
                          color: isCurrent || isPassed ? LEVEL_COLORS[stage] : '#808080',
                          opacity: isPassed && !isCurrent ? 0.5 : 1,
                        }}
                      >
                        {LEVEL_NAMES[stage]}
                      </div>
                      <div className="text-[10px] uppercase-spacex tracking-[0.1em] text-[#808080]">
                        {stage}
                      </div>
                      <div className="mt-1 text-[10px] tabular-nums text-[rgba(240,240,250,0.4)]">
                        {[0, 60, 70, 80, 90][i]}+
                      </div>
                      {isCurrent && (
                        <div className="mt-1 w-1.5 h-1.5 mx-auto animate-pulse" style={{ backgroundColor: LEVEL_COLORS[stage] }} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* 数据概览 */}
              {rank && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-1">总分</div>
                    <div className="font-display text-xl tabular-nums text-[#F0F0FA]">{rank.total_practiced}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-1">历史均分</div>
                    <div className="font-display text-xl tabular-nums text-[#F0F0FA]">{rank.avg_score}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-1">近30天</div>
                    <div className="font-display text-xl tabular-nums text-[#F0F0FA]">{rank.recent_30d_count}题</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-1">连胜</div>
                    <div className="font-display text-xl tabular-nums text-[#F0F0FA]">{rank.streak_days}天</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 打卡统计 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <StatCard
              label="活跃天数"
              value={heatmapSummary.total_active_days}
              unit="天"
              color="#F0F0FA"
            />
            <StatCard
              label="累计练习"
              value={heatmapSummary.total_practices}
              unit="次"
              color="#F0F0FA"
            />
            <StatCard
              label="日均练习"
              value={heatmapSummary.avg_daily_practices}
              unit="题"
              color="#F0F0FA"
            />
            <StatCard
              label="最长连胜"
              value={heatmapSummary.max_streak_days}
              unit="天"
              color="#F0F0FA"
            />
          </div>

          {/* 热力图 */}
          <div className="border border-[rgba(240,240,250,0.35)] p-6 mb-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080] mb-2">
                  练习热力图
                </div>
                <h2 className="font-display text-xl tracking-tight">
                  最近 {heatmapSummary.days} 天
                </h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#808080]">
                <span>少</span>
                <div className="flex gap-1">
                  <div className="w-3 h-3 border border-[rgba(240,240,250,0.2)]" />
                  <div className="w-3 h-3 bg-[rgba(240,240,250,0.15)]" />
                  <div className="w-3 h-3 bg-[rgba(240,240,250,0.35)]" />
                  <div className="w-3 h-3 bg-[rgba(240,240,250,0.6)]" />
                  <div className="w-3 h-3 bg-[#F0F0FA]" />
                </div>
                <span>多</span>
              </div>
            </div>

            {/* 星期标签 */}
            <div className="flex gap-1 mb-2">
              <div className="w-5" />
              {['一', '二', '三', '四', '五', '六', '日'].map(d => (
                <div key={d} className="flex-1 text-[10px] uppercase-spacex text-[#808080] text-center">
                  {d}
                </div>
              ))}
            </div>

            {/* 热力图网格 */}
            <div className="flex gap-1">
              {heatmapWeeks.map((week, wi) => (
                <div key={wi} className="flex-1 flex flex-col gap-1">
                  {week.map((day, di) => {
                    const isEmpty = day.count === -1
                    const intensity = day.count === 0
                      ? 0
                      : Math.min(Math.ceil((day.count / maxCount) * 4), 4)
                    const bgColors = [
                      'rgba(240,240,250,0.02)',
                      'rgba(240,240,250,0.1)',
                      'rgba(240,240,250,0.25)',
                      'rgba(240,240,250,0.5)',
                      'rgba(240,240,250,0.85)',
                    ]
                    return (
                      <button
                        key={di}
                        className={`aspect-square border transition-spacex ${
                          isEmpty
                            ? 'border-transparent'
                            : day.count > 0
                            ? 'border-[rgba(240,240,250,0.3)] hover:border-[#F0F0FA]'
                            : 'border-[rgba(240,240,250,0.08)]'
                        }`}
                        style={{
                          backgroundColor: isEmpty ? 'transparent' : bgColors[intensity],
                        }}
                        disabled={isEmpty}
                        onClick={() => !isEmpty && setSelectedDay(day)}
                        title={
                          isEmpty
                            ? ''
                            : `${day.date} | ${day.count}次练习${day.avg_score > 0 ? ` | 均分${day.avg_score}` : ''}`
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>

            {/* 选中日期详情 */}
            {selectedDay && selectedDay.count >= 0 && (
              <div className="mt-4 border border-[rgba(240,240,250,0.2)] p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-1">
                    {selectedDay.date}
                  </div>
                  <div className="text-sm text-[#F0F0FA] font-body">
                    {selectedDay.count > 0
                      ? `完成 ${selectedDay.count} 次练习${selectedDay.avg_score > 0 ? `，均分 ${selectedDay.avg_score}` : ''}`
                      : '这天没有练习'}
                  </div>
                </div>
                <button
                  className="text-xs uppercase-spacex text-[#808080] hover:text-[#F0F0FA] transition-spacex"
                  onClick={() => setSelectedDay(null)}
                >
                  清除
                </button>
              </div>
            )}

            {/* 今日状态 */}
            {todayData && todayData.count >= 0 && (
              <div className="mt-4 text-xs text-[rgba(240,240,250,0.5)] font-body">
                今天 {todayData.count > 0 ? `已练习 ${todayData.count} 次` : '还没有练习'}，
                {rank?.streak_days ? `连续 ${rank.streak_days} 天打卡中` : '开始打卡吧'}。
              </div>
            )}
          </div>

          {/* 快速入口 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/practice/full"
              className="w-full sm:w-auto border border-[rgba(240,240,250,0.35)] px-10 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex text-center"
            >
              <span className="text-xs uppercase-spacex tracking-[0.15em]">
                再来一轮 →
              </span>
            </Link>
            <Link
              to="/weakness"
              className="w-full sm:w-auto border border-[rgba(240,240,250,0.2)] px-10 py-4 hover:bg-[rgba(240,240,250,0.05)] transition-spacex text-center"
            >
              <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
                查看薄弱项
              </span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, unit, color }: {
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <div className="border border-[rgba(240,240,250,0.35)] p-4">
      <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-display text-2xl tabular-nums" style={{ color }}>
          {value}
        </span>
        <span className="text-xs text-[#808080]">{unit}</span>
      </div>
    </div>
  )
}