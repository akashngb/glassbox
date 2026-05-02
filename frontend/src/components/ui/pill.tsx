import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface PillProps {
  children: ReactNode
  href?: string
  chevron?: boolean
  className?: string
  onClick?: () => void
}

export function Pill({ children, href, chevron = false, className, onClick }: PillProps) {
  const classes = cn(
    'group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.025] px-3 py-1 text-[12px] text-zinc-300 transition-colors hover:border-white/25 hover:text-white',
    className,
  )

  const content = (
    <>
      {children}
      {chevron && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className="text-zinc-500 transition-colors group-hover:text-zinc-300"
          aria-hidden
        >
          <path
            d="M3.5 2L6.5 5L3.5 8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  )

  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick}>
        {content}
      </a>
    )
  }

  return (
    <span className={classes} onClick={onClick}>
      {content}
    </span>
  )
}
