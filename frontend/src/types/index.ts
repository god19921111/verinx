/** 题型分类 */
export type QuestionCategory =
  | '综合分析'
  | '人际沟通'
  | '应急应变'
  | '组织管理'
  | '自我认知'

/** 考试类型 */
export type ExamType = '国考' | '省考' | '事业单位'

/** 题目 */
export interface Question {
  id: string
  category: QuestionCategory
  exam_type: ExamType
  content: string
  difficulty: number
  answer_reference: string | null
  created_at: string
}

/** 练习模式 */
export type PracticeMode = 'single' | 'full'

/** 练习记录 */
export interface PracticeRecord {
  id: string
  user_id: string
  question_id: string
  question?: Question
  practice_mode: PracticeMode
  thinking_time: number | null
  answer_time: number | null
  answer_text: string | null
  audio_url: string | null
  video_url: string | null
  score_overall: number | null
  score_analysis: number | null
  score_expression: number | null
  score_adaptability: number | null
  score_organization: number | null
  score_appearance: number | null
  report_content: string | null
  dimension_analysis: Record<string, string> | null
  deduction_points: string | null
  optimization_suggestions: string | null
  follow_ups: FollowUpRecord[]
  created_at: string
}

/** 追问记录 */
export interface FollowUpRecord {
  id: string
  practice_record_id: string
  question_text: string
  answer_text: string | null
  audio_url: string | null
  created_at: string
}

/** 用户 */
export interface User {
  id: string
  phone: string
  name: string | null
  avatar: string | null
  member_type: 'free' | 'premium'
  member_expire_at: string | null
  daily_practice_count: number
  last_practice_date: string | null
  total_practice_count: number
  avg_score: number
  streak_days: number
  max_streak_days: number
  last_checkin_date: string | null
  total_checkin_days: number
  rank_score: number
}

/** 段位等级 */
export interface RankLevel {
  level: string
  min_score: number
  max_score: number
  label: string
  color: string
}

/** 打卡状态 */
export interface CheckinStatus {
  checked_today: boolean
  streak_days: number
  max_streak_days: number
  total_checkin_days: number
}

/** 每日挑战 */
export interface DailyChallenge {
  target_category: string
  challenge_name: string
  question: {
    id: string | null
    content: string | null
    category: string
    difficulty: number
  } | null
  completed_today: boolean
  user_level: RankLevel
  streak_days: number
  today_practice_count?: number
  daily_limit?: number | null
  is_premium?: boolean
}

/** 热力图数据 */
export interface HeatmapData {
  date: string
  count: number
  avg_score: number
  level: number
}

/** 段位数据 */
export interface RankData {
  rank_score: number
  level: RankLevel
  next_level: RankLevel | null
  progress_percent: number
  total_practiced: number
  recent_30d_count: number
  recent_30d_avg: number
  avg_score: number
  streak_days: number
  max_streak_days: number
}

/** 徽章 */
export interface Badge {
  code: string
  name: string
  icon: string
  description: string
  type: 'streak' | 'score' | 'challenge' | 'total'
  condition_value: number
  tier: 'bronze' | 'silver' | 'gold' | 'legend'
  color: string
  earned_at?: string
  progress?: number
  target?: number
}

/** 徽章墙数据 */
export interface BadgeWallData {
  earned: Badge[]
  next: Badge[]
  summary: {
    total_earned: number
    streak_days: number
    total_practices: number
    avg_score: number
  }
}

/** 收藏题目 */
export interface FavoriteItem {
  favorite_id: string
  question_id: string
  content: string
  category: string
  difficulty: number
  exam_type: string
}

/** 打卡记录 */
export interface CheckinRecordItem {
  id: string
  date: string
  category: string | null
  score: number | null
}
