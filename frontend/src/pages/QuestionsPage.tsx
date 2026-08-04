import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { QuestionCard } from '@/components/QuestionCard'
import { Badge } from '@/components/ui/Badge'
import api from '@/lib/api'
import type { Question, QuestionCategory, ExamType } from '@/types'

const categories: (QuestionCategory | '全部')[] = ['全部', '综合分析', '人际沟通', '应急应变', '组织管理', '自我认知']
const examTypes: (ExamType | '全部')[] = ['全部', '国考', '省考', '事业单位']

export function QuestionsPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState<QuestionCategory | '全部'>('全部')
  const [activeExamType, setActiveExamType] = useState<ExamType | '全部'>('全部')
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    const params: Record<string, string> = {
      page: String(page),
      page_size: '10',
    }
    if (activeCategory !== '全部') params.category = activeCategory
    if (activeExamType !== '全部') params.exam_type = activeExamType

    setLoading(true)
    api.get('/questions', { params })
      .then((res) => {
        const data = res.data.data || res.data
        setQuestions(data.items || data.list || [])
        setTotalPages(data.total_pages || Math.ceil((data.total || 0) / 10) || 1)
      })
      .catch(() => {
        setQuestions([])
      })
      .finally(() => setLoading(false))
  }, [activeCategory, activeExamType, page])

  const handleQuestionClick = (questionId: string) => {
    navigate(`/practice/single?questionId=${questionId}`)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">题库</h1>

      {/* Category Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((c) => (
          <Button
            key={c}
            variant={activeCategory === c ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => { setActiveCategory(c); setPage(1) }}
          >
            {c}
          </Button>
        ))}
      </div>

      {/* Exam Type Filter */}
      <div className="mt-3 flex flex-wrap gap-2">
        {examTypes.map((t) => (
          <button
            key={t}
            onClick={() => { setActiveExamType(t); setPage(1) }}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeExamType === t
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Question List */}
      <div className="mt-6 space-y-3">
        {loading && (
          <div className="py-12 text-center text-gray-400">加载中...</div>
        )}
        {!loading && questions.length === 0 && (
          <div className="py-12 text-center text-gray-400">暂无符合条件的题目</div>
        )}
        {!loading && questions.map((q) => (
          <div
            key={q.id}
            onClick={() => handleQuestionClick(q.id)}
            className="cursor-pointer"
          >
            <QuestionCard question={q} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
