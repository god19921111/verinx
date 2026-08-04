import React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger'
  children: React.ReactNode
  className?: string
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
