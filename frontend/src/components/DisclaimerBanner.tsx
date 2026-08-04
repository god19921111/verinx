interface DisclaimerBannerProps {
  className?: string
}

export function DisclaimerBanner({ className }: DisclaimerBannerProps) {
  return (
    <div className={`border border-[rgba(240,240,250,0.2)] p-4 ${className || ''}`}>
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-[rgba(245,158,11,0.9)]" />
        <span className="text-xs uppercase-spacex tracking-[0.15em] text-[#808080]">
          NOTICE
        </span>
      </div>
      <p className="mt-3 text-xs text-[rgba(240,240,250,0.5)]">
        AI评分仅作为备考练习参考，不等同考场考官打分
      </p>
    </div>
  )
}
