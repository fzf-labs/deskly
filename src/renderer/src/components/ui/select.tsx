'use client'

import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu'

export interface SelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: React.ReactNode
  disabled?: boolean
  triggerClassName?: string
  contentClassName?: string
  ariaLabel?: string
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  triggerClassName,
  contentClassName,
  ariaLabel
}: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const [triggerWidth, setTriggerWidth] = React.useState<number>()
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)

  const selectedOption = options.find((option) => option.value === value)

  React.useLayoutEffect(() => {
    if (!triggerRef.current) return

    const updateWidth = () => {
      setTriggerWidth(triggerRef.current?.getBoundingClientRect().width)
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(triggerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60',
            triggerClassName
          )}
        >
          <span className={cn('truncate text-left', !selectedOption && 'text-muted-foreground')}>
            {selectedOption?.label ?? placeholder}
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn('max-h-72 overflow-y-auto p-1', contentClassName)}
        style={triggerWidth ? { width: triggerWidth } : undefined}
      >
        {options.map((option) => {
          const isSelected = option.value === value

          return (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => {
                onValueChange(option.value)
                setOpen(false)
              }}
              className={cn(
                'focus:bg-accent focus:text-accent-foreground relative flex w-full items-center rounded-sm py-1.5 pr-2 pl-8 text-sm transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50',
                isSelected && 'bg-accent/55 text-accent-foreground'
              )}
            >
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected ? <Check className="size-4" /> : null}
              </span>
              <span className="truncate">{option.label}</span>
            </button>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
