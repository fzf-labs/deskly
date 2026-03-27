import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Globe } from 'lucide-react'

import { shell } from '@/lib/electron-api'
import { cn } from '@/lib/utils'

import {
  parseSearchResults,
  type SearchGroup,
  type SearchResult
} from '../model/web-search'
import type { Artifact } from '../model/types'

function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

async function openUrl(url: string) {
  try {
    await shell.openUrl(url)
  } catch {
    window.open(url, '_blank')
  }
}

interface SearchResultItemProps {
  result: SearchResult
}

function SearchResultItem({ result }: SearchResultItemProps) {
  const faviconUrl = getFaviconUrl(result.url)
  const domain = getDomain(result.url)

  return (
    <button
      onClick={() => openUrl(result.url)}
      className="hover:bg-muted/30 group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors"
    >
      <div className="flex size-6 shrink-0 items-center justify-center">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            className="size-4 rounded-sm"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
              event.currentTarget.nextElementSibling?.classList.remove('hidden')
            }}
          />
        ) : null}
        <Globe className={cn('text-muted-foreground size-4', faviconUrl && 'hidden')} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate text-xs font-medium">
          {result.title || domain}
        </div>
        <div className="text-muted-foreground truncate text-[11px]">{domain}</div>
      </div>
      <ExternalLink className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

interface SearchGroupCardProps {
  group: SearchGroup
  defaultExpanded?: boolean
}

function SearchGroupCard({
  group,
  defaultExpanded = true
}: SearchGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-muted/30 hover:bg-muted/50 flex w-full cursor-pointer items-center gap-3 px-4 py-3 transition-colors"
      >
        <Globe className="text-muted-foreground size-5 shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <div className="text-foreground truncate text-sm font-medium">
            {group.query || 'Search Results'}
          </div>
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">
          {group.results.length} results
        </span>
        {isExpanded ? (
          <ChevronUp className="text-muted-foreground size-4 shrink-0" />
        ) : (
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="divide-y divide-none py-2">
          {group.results.map((result, index) => (
            <SearchResultItem key={index} result={result} />
          ))}
        </div>
      )}
    </div>
  )
}

export function WebSearchPreview({ artifact }: { artifact: Artifact }) {
  const content = artifact.content || ''
  const groups = parseSearchResults(content)

  console.log('[WebSearchPreview] Content length:', content.length)
  console.log('[WebSearchPreview] Content preview:', content.slice(0, 200))
  console.log('[WebSearchPreview] Parsed groups:', groups.length, groups)

  if (groups.length === 0 || groups.every((group) => group.results.length === 0)) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <Globe className="text-muted-foreground/50 mb-4 size-12" />
        <p className="text-muted-foreground text-sm">No search results</p>
        {content && (
          <details className="mt-4 max-w-md">
            <summary className="text-muted-foreground cursor-pointer text-xs">
              Show raw content
            </summary>
            <pre className="bg-muted mt-2 max-h-40 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
              {content.slice(0, 500)}...
            </pre>
          </details>
        )}
      </div>
    )
  }

  const totalResults = groups.reduce((sum, group) => sum + group.results.length, 0)

  return (
    <div className="h-full overflow-auto">
      <div className="p-4">
        <div className="text-muted-foreground mb-4 text-xs tracking-wide uppercase">
          {groups.length} {groups.length === 1 ? 'search' : 'searches'} · {totalResults} results
        </div>
        <div className="space-y-4">
          {groups.map((group, index) => (
            <SearchGroupCard key={index} group={group} defaultExpanded={index === 0} />
          ))}
        </div>
      </div>
    </div>
  )
}
