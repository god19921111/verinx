import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '@/lib/api'
import type { Badge, BadgeWallData, CheckinRecordItem } from '@/types'

const TIER_ORDER = ['bronze', 'silver', 'gold', 'legend']
const TIER_NAMES: Record<string, string> = {
  bronze: '青铜',
  silver: '白银',
  gold: '黄金',
  legend: '传奇',
}

const TYPE_LABELS: Record<string, string> = {
  streak: '连胜徽章',
  score: '分数徽章',
  challenge: '挑战徽章',
  total: '练习量徽章',
}

export function AchievementsPage() {
  const { isAuthenticated } = useAuthStore()
  const [badgeData, setBadgeData] = useState<BadgeWallData | null>(null)
  const [checkinHistory, setCheckinHistory] = useState<CheckinRecordItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    Promise.all([
      api.get('/stats/badges').then(r => r.data.data || r.data).catch(() => null),
      api.get('/stats/checkin-history').then(r => r.data.data || r.data).catch(() => null),
    ]).then(([badges, history]) => {
      if (badges) setBadgeData(badges)
      if (history) setCheckinHistory(history.records || [])
      setLoading(false)
    })
  }, [isAuthenticated])

  const earnedByType = (type: string) => {
    if (!badgeData) return []
    return badgeData.earned.filter(b => b.type === type)
  }

  const nextByType = (type: string) => {
    if (!badgeData) return []
    return badgeData.next.filter(b => b.type === type)
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <div className="text-xs uppercase-spacex text-[#808080] tracking-[0.2em] mb-2">
          ACHIEVEMENTS
        </div>
        <h1 className="font-display text-3xl tracking-tight">徽章成就</h1>
        <p className="mt-2 text-sm text-[rgba(240,240,250,0.6)] font-body">
          每一枚徽章都是你努力的见证
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-[#808080] text-sm">加载中...</div>
      ) : badgeData ? (
        <>
          {/* 总览 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="已获徽章" value={badgeData.summary.total_earned} color="#F0F0FA" />
            <StatCard label="连续天数" value={badgeData.summary.streak_days} color="#ffd700" />
            <StatCard label="累计练习" value={badgeData.summary.total_practices} color="#34d399" />
            <StatCard label="历史均分" value={badgeData.summary.avg_score} color="#60a5fa" />
          </div>

          {/* 连胜徽章 */}
          <BadgeSection
            title="连胜徽章"
            icon="🔥"
            earned={earnedByType('streak')}
            next={nextByType('streak')}
          />

          {/* 分数徽章 */}
          <BadgeSection
            title="分数徽章"
            icon="🎯"
            earned={earnedByType('score')}
            next={nextByType('score')}
          />

          {/* 练习量徽章 */}
          <BadgeSection
            title="练习量徽章"
            icon="📈"
            earned={earnedByType('total')}
            next={nextByType('total')}
          />

          {/* 打卡历史 */}
          {checkinHistory.length > 0 && (
            <div className="border border-[rgba(240,240,250,0.35)] p-6 mt-8">
              <div className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080] mb-4">
                最近打卡
              </div>
              <div className="flex flex-wrap gap-2">
                {checkinHistory.slice(0, 20).map(record => (
                  <div
                    key={record.id}
                    className="px-3 py-2 border border-[rgba(240,240,250,0.15)] text-center"
                  >
                    <div className="text-xs text-[#F0F0FA] font-body">{record.date}</div>
                    {record.score !== null && (
                      <div className="text-[10px] text-[#808080]">{record.score}分</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <Link
              to="/checkin"
              className="inline-block border border-[rgba(240,240,250,0.35)] px-12 py-4 hover:bg-[rgba(240,240,250,0.1)] transition-spacex"
            >
              <span className="text-xs uppercase-spacex tracking-[0.15em]">
                去打卡 →
              </span>
            </Link>
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-[#808080]">
          暂无数据，开始打卡获得第一枚徽章吧
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="border border-[rgba(240,240,250,0.35)] p-4">
      <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-2">
        {label}
      </div>
      <div className="font-display text-3xl tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  )
}

function BadgeSection({
  title,
  icon,
  earned,
  next,
}: {
  title: string
  icon: string
  earned: Badge[]
  next: Badge[]
}) {
  return (
    <div className="border border-[rgba(240,240,250,0.2)] p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">{icon}</span>
        <span className="text-xs uppercase-spacex tracking-[0.2em] text-[#808080]">
          {title}
        </span>
      </div>

      {earned.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
          {earned.map(b => (
            <div
              key={b.code}
              className="border p-4 text-center"
              style={{
                borderColor: `${b.color}60`,
                background: `linear-gradient(180deg, ${b.color}10 0%, transparent 100%)`,
              }}
            >
              <div className="text-3xl mb-2">{b.icon}</div>
              <div
                className="text-xs uppercase-spacex tracking-[0.1em] mb-1"
                style={{ color: b.color }}
              >
                {b.name}
              </div>
              <div className="text-[10px] text-[#808080]">
                {TIER_NAMES[b.tier]} · {b.description}
              </div>
              {b.earned_at && (
                <div className="text-[10px] text-[rgba(240,240,250,0.4)] mt-1">
                  {b.earned_at.split(' ')[0]}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[#808080] mb-4">尚未获得此类徽章</div>
      )}

      {next.length > 0 && (
        <div className="border-t border-[rgba(240,240,250,0.1)] pt-4">
          <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-3">
            下一个目标
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {next.slice(0, 4).map(b => (
              <div
                key={b.code}
                className="border border-dashed border-[rgba(240,240,250,0.2)] p-3 text-center opacity-60"
              >
                <div className="text-2xl mb-1 grayscale">{b.icon}</div>
                <div className="text-xs text-[#808080]">{b.name}</div>
                <div className="text-[10px] text-[rgba(240,240,250,0.4)] mt-1">
                  {b.progress ?? 0} / {b.target ?? 0}
                </div>
                <div className="h-1 bg-[rgba(240,240,250,0.1)] mt-2">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, ((b.progress ?? 0) / (b.target || 1)) * 100)}%`,
                      backgroundColor: b.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
