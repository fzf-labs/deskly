import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { shell } from '@/lib/electron-api'
import { cn } from '@/lib/utils'

export function CodexMarkdownBlock({ content, className }: { content: string; className?: string }): React.ReactNode {
  const components = {
    a: ({ children, href }: any) => (
      <a
        href={href}
        onClick={async (event) => {
          event.preventDefault()
          if (!href) return
          try {
            await shell.openUrl(href)
          } catch {
            window.open(href, '_blank')
          }
        }}
        className="text-primary cursor-pointer underline underline-offset-2"
      >
        {children}
      </a>
    ),
    pre: ({ children }: any) => (
      <pre className="bg-muted/65 overflow-x-auto rounded-lg border border-border/50 p-3 text-xs leading-6">
        {children}
      </pre>
    ),
    code: ({ className: codeClassName, children, ...props }: any) => {
      const isInline = !codeClassName
      if (isInline) {
        return (
          <code className="bg-muted/70 rounded px-1.5 py-0.5 text-[0.9em]" {...props}>
            {children}
          </code>
        )
      }
      return (
        <code className={codeClassName} {...props}>
          {children}
        </code>
      )
    },
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-2 border-border/70 pl-4 text-muted-foreground">
        {children}
      </blockquote>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }: any) => <thead className="bg-muted/50">{children}</thead>,
    th: ({ children }: any) => (
      <th className="border border-border/60 px-3 py-2 text-left font-medium">{children}</th>
    ),
    td: ({ children }: any) => <td className="border border-border/60 px-3 py-2 align-top">{children}</td>,
    p: ({ children }: any) => <p className="leading-7">{children}</p>
  } as Components

  return (
    <div
      className={cn(
        'w-full border-l border-border/30 bg-transparent px-3 py-0.5',
        className
      )}
    >
      <div className="prose prose-sm max-w-none min-w-0 text-foreground [&_ol]:pl-5 [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:pl-5">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
