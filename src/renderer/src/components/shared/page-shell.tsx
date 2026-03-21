import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface PageFrameProps {
  children: ReactNode
  className?: string
  bodyClassName?: string
}

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

interface PageBodyProps {
  children: ReactNode
  className?: string
}

interface PageSectionProps {
  children: ReactNode
  className?: string
}

interface SurfaceCardProps {
  children: ReactNode
  className?: string
  interactive?: boolean
}

interface EmptyStatePanelProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function PageFrame({ children, className, bodyClassName }: PageFrameProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      <div className={cn('page-shell-body flex min-h-0 flex-1 flex-col', bodyClassName)}>
        {children}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-4 border-b border-border/70 px-6 py-5 md:px-8',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-foreground text-[1.7rem] font-semibold tracking-tight">{title}</h1>
        {subtitle ? (
          <p className="text-muted-foreground mt-1 text-sm leading-6">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function PageBody({ children, className }: PageBodyProps) {
  return (
    <div
      className={cn(
        'page-shell-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8',
        className
      )}
    >
      {children}
    </div>
  )
}

export function PageSection({ children, className }: PageSectionProps) {
  return <section className={cn('space-y-4', className)}>{children}</section>
}

export function SurfaceCard({ children, className, interactive = false }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        'surface-card rounded-[24px] border border-border/70 bg-card/92 p-4',
        interactive && 'hover:border-border hover:bg-card transition-colors duration-200',
        className
      )}
    >
      {children}
    </div>
  )
}

export function EmptyStatePanel({
  title,
  description,
  action,
  icon,
  className
}: EmptyStatePanelProps) {
  return (
    <div
      className={cn(
        'surface-muted flex min-h-[220px] flex-col items-center justify-center rounded-[28px] border border-dashed border-border/80 px-8 py-10 text-center',
        className
      )}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-background shadow-sm">
          {icon}
        </div>
      ) : null}
      <div className="text-foreground text-lg font-semibold">{title}</div>
      {description ? (
        <div className="text-muted-foreground mt-2 max-w-xl text-sm leading-6">{description}</div>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
