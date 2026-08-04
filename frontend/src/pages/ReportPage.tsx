import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ScoreCard } from '@/components/ScoreCard'
import { DisclaimerBanner } from '@/components/DisclaimerBanner'
import api from '@/lib/api'
import type { PracticeRecord } from '@/types'

export function ReportPage() {
  const { id } = useParams<{ id: string }>()
  const [record, setRecord] = useState<PracticeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [similarQuestions, setSimilarQuestions] = useState<any[]>([])

  // 优秀答案对照
  const [excellentData, setExcellentData] = useState<{
    excellent_answer: string
    answer_framework: string[]
    comparison: {
      strengths: string[]
      gaps: string[]
      improvement: string
    }
    key_phrases: string[]
  } | null>(null)
  const [excellentLoading, setExcellentLoading] = useState(false)
  const [excellentError, setExcellentError] = useState<string>('')

  const loadExcellentAnswer = async () => {
    if (!id || excellentData || excellentLoading) return
    setExcellentLoading(true)
    setExcellentError('')
    try {
      const res = await api.get(`/stats/excellent-answer/${id}`)
      const data = res.data.data || res.data
      setExcellentData(data)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || '生成失败，请稍后重试'
      setExcellentError(msg)
    } finally {
      setExcellentLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get(`/practice/${id}`)
      .then((res) => {
        const data = res.data.data || res.data
        setRecord(data)

        // Fetch similar questions based on category
        if (data.question?.category) {
          api.get('/questions', {
            params: { category: data.question.category, page_size: 3 },
          }).then((qRes) => {
            const qData = qRes.data.data || qRes.data
            const items = (qData.items || qData.list || []).filter(
              (q: any) => q.id !== data.question_id
            )
            setSimilarQuestions(items.slice(0, 3))
          }).catch(() => {})
        }
      })
      .catch(() => setRecord(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="py-12 text-center text-gray-400">加载报告中...</div>
      </div>
    )
  }

  if (!record) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="py-12 text-center">
          <p className="text-gray-500">未找到该练习记录</p>
          <Button variant="primary" className="mt-4" onClick={() => window.history.back()}>
            返回
          </Button>
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const deductionPoints = record.deduction_points
    ? (typeof record.deduction_points === 'string'
      ? JSON.parse(record.deduction_points)
      : record.deduction_points)
    : []

  const suggestions = record.optimization_suggestions
    ? (typeof record.optimization_suggestions === 'string'
      ? JSON.parse(record.optimization_suggestions)
      : record.optimization_suggestions)
    : []

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-lg font-semibold text-gray-900">评分报告</h1>

      {/* Score Card */}
      <div className="mt-4">
        <ScoreCard
          overall={record.score_overall ?? 0}
          scores={{
            analysis: record.score_analysis ?? 0,
            expression: record.score_expression ?? 0,
            adaptability: record.score_adaptability ?? 0,
            organization: record.score_organization ?? 0,
          }}
          weights={{
            analysis: 0.30,
            expression: 0.25,
            adaptability: 0.25,
            organization: 0.20,
          }}
          reportContent={record.report_content ?? undefined}
          dimensionAnalysis={record.dimension_analysis ?? undefined}
          deductionPoints={record.deduction_points ?? undefined}
          optimizationSuggestions={record.optimization_suggestions ?? undefined}
        />
      </div>

      {/* Meta Info */}
      <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
        {record.question?.category && (
          <Badge variant="default">{record.question.category}</Badge>
        )}
        <Badge variant={record.practice_mode === 'full' ? 'warning' : 'success'}>
          {record.practice_mode === 'full' ? '全真模拟' : '专项训练'}
        </Badge>
        <span>{formatDate(record.created_at)}</span>
      </div>

      {/* Deduction Points */}
      {deductionPoints.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>扣分要点</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {deductionPoints.map((p: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Optimization Suggestions */}
      {suggestions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>优化建议</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {suggestions.map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Reference Answer */}
      {record.question?.answer_reference && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>参考答案</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {record.question.answer_reference}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Excellent Answer Comparison (AI-generated, lazy loaded) */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>优秀答案对照</CardTitle>
            {!excellentData && !excellentLoading && (
              <Button
                variant="primary"
                size="sm"
                onClick={loadExcellentAnswer}
                disabled={excellentLoading}
              >
                生成优秀答案
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {excellentLoading && (
            <div className="py-8 text-center text-sm text-gray-500">
              <div className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2 align-middle" />
              AI 正在生成优秀答案与对比分析，请稍候...
            </div>
          )}

          {!excellentLoading && excellentError && (
            <div className="py-4 text-center">
              <p className="text-sm text-red-500 mb-3">{excellentError}</p>
              <Button variant="outline" size="sm" onClick={loadExcellentAnswer}>
                重试
              </Button>
            </div>
          )}

          {!excellentLoading && !excellentData && !excellentError && (
            <div className="py-6 text-center text-sm text-gray-500">
              点击"生成优秀答案"，AI 将生成满分参考答案并与你的回答进行对比分析
            </div>
          )}

          {excellentData && (
            <div className="space-y-5">
              {/* 优秀参考答案 */}
              <div>
                <div className="text-xs font-semibold text-green-600 mb-2 uppercase tracking-wide">
                  优秀参考答案
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {excellentData.excellent_answer}
                </p>
              </div>

              {/* 答题框架要点 */}
              {excellentData.answer_framework && excellentData.answer_framework.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-blue-600 mb-2 uppercase tracking-wide">
                    答题框架要点
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {excellentData.answer_framework.map((point, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs"
                      >
                        <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center mr-1.5">
                          {i + 1}
                        </span>
                        {point}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 对比分析 */}
              {excellentData.comparison && (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    对比分析
                  </div>

                  {/* 亮点 */}
                  {excellentData.comparison.strengths && excellentData.comparison.strengths.length > 0 && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                        <span>✓</span> 回答亮点
                      </div>
                      <ul className="space-y-1.5">
                        {excellentData.comparison.strengths.map((s, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 不足 */}
                  {excellentData.comparison.gaps && excellentData.comparison.gaps.length > 0 && (
                    <div className="p-3 bg-orange-50 rounded-lg">
                      <div className="text-xs font-medium text-orange-700 mb-2 flex items-center gap-1">
                        <span>!</span> 不足之处
                      </div>
                      <ul className="space-y-1.5">
                        {excellentData.comparison.gaps.map((g, i) => (
                          <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="text-orange-500 mt-0.5">•</span>
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 改进建议 */}
                  {excellentData.comparison.improvement && (
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="text-xs font-medium text-blue-700 mb-1">提升路径</div>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {excellentData.comparison.improvement}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 金句推荐 */}
              {excellentData.key_phrases && excellentData.key_phrases.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-purple-600 mb-2 uppercase tracking-wide">
                    答题金句
                  </div>
                  <div className="space-y-2">
                    {excellentData.key_phrases.map((phrase, i) => (
                      <blockquote
                        key={i}
                        className="pl-3 border-l-2 border-purple-400 text-sm text-gray-700 italic"
                      >
                        {phrase}
                      </blockquote>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up History */}
      {record.follow_ups && record.follow_ups.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>追问记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {record.follow_ups.map((fu, i) => (
                <div key={fu.id} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="warning">追问 {i + 1}</Badge>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{fu.question_text}</p>
                  {fu.answer_text && (
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{fu.answer_text}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Similar Questions */}
      {similarQuestions.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>相似题目推荐</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {similarQuestions.map((q: any) => (
                <Link
                  key={q.id}
                  to={`/practice/single?questionId=${q.id}`}
                  className="block rounded-lg border border-gray-100 p-3 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default">{q.category}</Badge>
                  </div>
                  <p className="text-sm text-gray-700">{q.content}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="mt-6">
        <DisclaimerBanner />
      </div>
    </div>
  )
}
