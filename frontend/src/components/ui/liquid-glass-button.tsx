import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const liquidVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-full font-bold text-[13px]',
    'transition-[transform,box-shadow] duration-200',
    'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
    'overflow-hidden isolate',
    'border border-white/15',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_24px_-12px_rgba(0,0,0,0.55)]',
    'hover:-translate-y-[1px] active:translate-y-0',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-5',
        lg: 'h-12 px-6 text-[14px]',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export interface LiquidButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof liquidVariants> {
  asChild?: boolean
  children?: ReactNode
}

export const LiquidButton = forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, size, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <>
        <LiquidGlassFilter />
        <Comp
          ref={ref}
          className={cn(
            liquidVariants({ size }),
            'text-[var(--color-fg)]',
            'bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))]',
            '[backdrop-filter:url(#liquid-glass-distort)_blur(8px)_saturate(140%)]',
            'before:absolute before:inset-0 before:rounded-full',
            'before:bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.45),transparent_55%)]',
            'before:opacity-70 before:pointer-events-none',
            className,
          )}
          {...props}
        >
          <span className="relative z-10 flex items-center gap-2">{children}</span>
        </Comp>
      </>
    )
  },
)
LiquidButton.displayName = 'LiquidButton'

const metalVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-full font-bold text-[13px]',
    'transition-[transform,box-shadow,filter] duration-200',
    'focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
    'border',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.35),0_4px_14px_-6px_rgba(0,0,0,0.6)]',
    'hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.35),0_8px_18px_-6px_rgba(0,0,0,0.7)]',
    'active:translate-y-0',
  ],
  {
    variants: {
      variant: {
        default: 'bg-[linear-gradient(180deg,#3a4150_0%,#1c2029_100%)] border-white/10 text-[var(--color-fg)]',
        primary: 'bg-[linear-gradient(180deg,var(--color-accent)_0%,var(--color-accent-strong)_100%)] border-[color-mix(in_oklab,var(--color-accent)_60%,white_40%)] text-[var(--color-bg)]',
        ghost:   'bg-transparent border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] shadow-none',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-5',
        lg: 'h-12 px-6 text-[14px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface MetalButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof metalVariants> {
  asChild?: boolean
  children?: ReactNode
}

export const MetalButton = forwardRef<HTMLButtonElement, MetalButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(metalVariants({ variant, size }), className)}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </Comp>
    )
  },
)
MetalButton.displayName = 'MetalButton'

function LiquidGlassFilter() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute" style={{ position: 'absolute' }}>
      <defs>
        <filter id="liquid-glass-distort" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="9" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.2" result="blurred" />
          <feDisplacementMap in="SourceGraphic" in2="blurred" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}
