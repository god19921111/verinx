interface QuestionCardProps {
  question: {
    id: string
    category: string
    exam_type: string
    content: string
    difficulty: number
  }
  showAnswer?: boolean
  answerReference?: string
}

function DifficultyStars({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 ${
            i < level ? 'bg-[#F0F0FA]' : 'bg-[rgba(240,240,250,0.2)]'
          }`}
        />
      ))}
    </span>
  )
}

export function QuestionCard({
  question,
  showAnswer = false,
  answerReference,
}: QuestionCardProps) {
  return (
    <div className="border border-[rgba(240,240,250,0.35)]">
      <div className="border-b border-[rgba(240,240,250,0.35)] p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs uppercase-spacex tracking-[0.1em] text-[#808080]">
            {question.category}
          </span>
          <span className="text-xs uppercase-spacex tracking-[0.1em] text-[rgba(240,240,250,0.5)]">
            {question.exam_type}
          </span>
          <DifficultyStars level={question.difficulty} />
        </div>
      </div>
      <div className="p-8">
        <p className="text-[rgba(240,240,250,0.9)] font-body leading-relaxed">
          {question.content}
        </p>

        {showAnswer && answerReference && (
          <div className="mt-8 pt-6 border-t border-[rgba(240,240,250,0.2)]">
            <div className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080] mb-4">
              REFERENCE ANSWER
            </div>
            <p className="text-sm text-[rgba(240,240,250,0.6)] font-body leading-relaxed">
              {answerReference}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
