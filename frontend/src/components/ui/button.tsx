import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-white/40 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-white text-black hover:bg-white/90',
        outline:
          'border-white/20 bg-transparent text-[var(--color-fg)] hover:bg-white/5',
        secondary:
          'bg-white/10 text-[var(--color-fg)] hover:bg-white/15',
        ghost:
          'bg-transparent text-[var(--color-fg-muted)] hover:bg-white/5 hover:text-[var(--color-fg)]',
        destructive:
          'bg-[var(--color-bad)]/15 text-[var(--color-bad)] hover:bg-[var(--color-bad)]/25',
        link: 'text-[var(--color-fg)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 gap-1.5 px-3',
        xs: 'h-6 gap-1 rounded-md px-2 text-xs',
        sm: 'h-7 gap-1 rounded-md px-2.5 text-[0.8rem]',
        lg: 'h-10 gap-1.5 px-5 text-[13.5px]',
        icon: 'size-8',
        'icon-xs': 'size-6 rounded-md',
        'icon-sm': 'size-7 rounded-md',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
