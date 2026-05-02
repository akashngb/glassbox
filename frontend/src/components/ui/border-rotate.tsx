import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type AnimationMode = 'auto-rotate' | 'rotate-on-hover' | 'stop-rotate-on-hover'

interface BorderRotateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  children: ReactNode
  className?: string
  animationMode?: AnimationMode
  animationSpeed?: number
  gradientColors?: {
    primary: string
    secondary: string
    accent: string
  }
  backgroundColor?: string
  borderWidth?: number
  borderRadius?: number
  style?: CSSProperties
}

const defaultGradientColors = {
  primary: '#584827',
  secondary: '#c7a03c',
  accent: '#f9de90',
}

export function BorderRotate({
  children,
  className,
  animationMode = 'auto-rotate',
  animationSpeed = 5,
  gradientColors = defaultGradientColors,
  backgroundColor = '#0a0a0b',
  borderWidth = 1,
  borderRadius = 14,
  style = {},
  ...props
}: BorderRotateProps) {
  const animationClass =
    animationMode === 'auto-rotate'
      ? 'gradient-border-auto'
      : animationMode === 'rotate-on-hover'
        ? 'gradient-border-hover'
        : 'gradient-border-stop-hover'

  const combinedStyle: CSSProperties = {
    ['--animation-duration' as string]: `${animationSpeed}s`,
    border: `${borderWidth}px solid transparent`,
    borderRadius: `${borderRadius}px`,
    backgroundImage: `
      linear-gradient(${backgroundColor}, ${backgroundColor}),
      conic-gradient(
        from var(--gradient-angle, 0deg),
        ${gradientColors.primary} 0%,
        ${gradientColors.secondary} 37%,
        ${gradientColors.accent} 30%,
        ${gradientColors.secondary} 33%,
        ${gradientColors.primary} 40%,
        ${gradientColors.primary} 50%,
        ${gradientColors.secondary} 77%,
        ${gradientColors.accent} 80%,
        ${gradientColors.secondary} 83%,
        ${gradientColors.primary} 90%
      )
    `,
    ...style,
  }

  return (
    <div
      className={cn('gradient-border-component', animationClass, className)}
      style={combinedStyle}
      {...props}
    >
      {children}
    </div>
  )
}
