import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const comparisonItems = [
  { feature: '每日练习次数', free: '3次/天', premium: '不限次数', highlight: true },
  { feature: '答题视频保存', free: false, premium: true },
  { feature: '深度评分分析', free: false, premium: true },
  { feature: '题库完整访问', free: '部分题目', premium: '全量题库', highlight: true },
  { feature: '追问轮次', free: '1轮', premium: '最多3轮', highlight: true },
  { feature: '参考答案查看', free: false, premium: true },
  { feature: '相似题推荐', free: false, premium: true },
  { feature: '优先客服支持', free: false, premium: true },
]

export function MembershipPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-50 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-7 h-7 text-amber-500">
            <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 12v4h14v-4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">开通会员</h1>
        <p className="mt-2 text-sm text-gray-500">解锁全部功能，高效备考公考面试</p>
      </div>

      {/* Comparison Table */}
      <Card className="mt-8 overflow-hidden">
        <div className="grid grid-cols-3 border-b border-gray-100 bg-gray-50">
          <div className="px-4 py-3 text-sm font-medium text-gray-500">功能</div>
          <div className="px-4 py-3 text-sm font-medium text-gray-500 text-center">免费用户</div>
          <div className="px-4 py-3 text-sm font-medium text-amber-600 text-center">付费会员</div>
        </div>
        <div className="divide-y divide-gray-50">
          {comparisonItems.map((item) => (
            <div
              key={item.feature}
              className={`grid grid-cols-3 ${item.highlight ? 'bg-primary/5' : ''}`}
            >
              <div className="px-4 py-3 text-sm text-gray-700">{item.feature}</div>
              <div className="px-4 py-3 flex items-center justify-center">
                {typeof item.free === 'boolean' ? (
                  item.free ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-green-500">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-300">
                      <line x1="18" x2="6" y1="6" y2="18" />
                      <line x1="6" x2="18" y1="6" y2="18" />
                    </svg>
                  )
                ) : (
                  <span className="text-sm text-gray-500">{item.free}</span>
                )}
              </div>
              <div className="px-4 py-3 flex items-center justify-center">
                {typeof item.premium === 'boolean' ? (
                  item.premium ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-primary">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-300">
                      <line x1="18" x2="6" y1="6" y2="18" />
                      <line x1="6" x2="18" y1="6" y2="18" />
                    </svg>
                  )
                ) : (
                  <span className="text-sm font-medium text-primary">{item.premium}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pricing Card */}
      <Card className="mt-6 border-2 border-primary">
        <CardContent className="py-6 text-center">
          <div className="text-sm text-gray-500">付费会员</div>
          <div className="mt-2 flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-gray-900">¥99</span>
            <span className="text-sm text-gray-500">/月</span>
          </div>
          <p className="mt-2 text-xs text-gray-400">连续包月，随时可取消</p>
          <Button size="lg" className="mt-4 w-full" onClick={() => alert('支付功能开发中，敬请期待')}>
            立即开通
          </Button>
        </CardContent>
      </Card>

      {/* Note */}
      <div className="mt-4 text-center text-xs text-gray-400">
        开通即表示同意《会员服务协议》
      </div>
    </div>
  )
}
