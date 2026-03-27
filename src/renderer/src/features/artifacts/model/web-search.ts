export interface SearchResult {
  title: string
  url: string
  snippet?: string
}

export interface SearchGroup {
  query: string
  results: SearchResult[]
}

function extractJsonArray(content: string, startIndex: number): string | null {
  if (content[startIndex] !== '[') return null

  let depth = 0
  let inString = false
  let escape = false

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\' && inString) {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '[') depth += 1
      if (char === ']') {
        depth -= 1
        if (depth === 0) {
          return content.slice(startIndex, index + 1)
        }
      }
    }
  }

  return null
}

export function parseSearchResults(content: string): SearchGroup[] {
  const groups: SearchGroup[] = []

  if (!content || content.trim() === '') {
    return groups
  }

  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      groups.push({ query: '', results: parsed })
      return groups
    }
    if (parsed.results) {
      groups.push({ query: parsed.query || '', results: parsed.results })
      return groups
    }
    if (parsed.queries) {
      for (const query of parsed.queries) {
        groups.push({ query: query.query || '', results: query.results || [] })
      }
      return groups
    }
  } catch {
    // Fall through to text parsing for mixed-format content.
  }

  const queryRegex = /Web search results for(?: query)?:\s*"([^"]+)"/gi
  const queryMatches: { query: string; index: number }[] = []
  let queryMatch: RegExpExecArray | null
  while ((queryMatch = queryRegex.exec(content)) !== null) {
    queryMatches.push({ query: queryMatch[1], index: queryMatch.index })
  }

  console.log(
    '[WebSearchPreview] Query matches:',
    queryMatches.length,
    queryMatches.map((query) => query.query)
  )

  let searchPos = 0
  const linksSections: { links: SearchResult[]; index: number }[] = []

  while (true) {
    const linksIndex = content.indexOf('Links:', searchPos)
    if (linksIndex === -1) break

    let bracketPos = linksIndex + 6
    while (bracketPos < content.length && /\s/.test(content[bracketPos])) {
      bracketPos += 1
    }

    if (content[bracketPos] === '[') {
      const jsonStr = extractJsonArray(content, bracketPos)
      console.log(
        '[WebSearchPreview] Found Links at',
        linksIndex,
        'JSON length:',
        jsonStr?.length
      )

      if (jsonStr) {
        try {
          const links = JSON.parse(jsonStr)
          if (Array.isArray(links)) {
            linksSections.push({
              links: links.map((link: { title?: string; url?: string }) => ({
                title: link.title || '',
                url: link.url || ''
              })),
              index: linksIndex
            })
            console.log('[WebSearchPreview] Parsed', links.length, 'links')
          }
        } catch (error) {
          console.log('[WebSearchPreview] JSON parse error:', error)
        }
      }
    }

    searchPos = linksIndex + 1
  }

  console.log('[WebSearchPreview] Links sections found:', linksSections.length)

  if (queryMatches.length > 0 && linksSections.length > 0) {
    for (let index = 0; index < queryMatches.length; index += 1) {
      const queryMatchEntry = queryMatches[index]
      const nextQueryIndex = queryMatches[index + 1]?.index ?? Number.POSITIVE_INFINITY

      const linksForQuery = linksSections.find(
        (linkSection) =>
          linkSection.index > queryMatchEntry.index && linkSection.index < nextQueryIndex
      )

      if (linksForQuery) {
        groups.push({ query: queryMatchEntry.query, results: linksForQuery.links })
      }
    }
  } else if (linksSections.length > 0) {
    for (const linkSection of linksSections) {
      groups.push({ query: '', results: linkSection.links })
    }
  }

  return groups
}

export function hasValidSearchResults(content: string): boolean {
  const groups = parseSearchResults(content)
  return groups.length > 0 && groups.some((group) => group.results.length > 0)
}
