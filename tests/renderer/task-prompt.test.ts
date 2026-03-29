import { describe, expect, it } from 'vitest'

import {
  compileTaskPrompt,
  getTaskPromptVisibleText,
  hasTaskPromptContent,
  normalizeTaskPromptNodes,
  replaceTaskPromptWithText,
  type TaskPromptNode
} from '../../src/renderer/src/features/tasks/model/task-prompt'

describe('task-prompt', () => {
  it('normalizes adjacent text nodes', () => {
    expect(
      normalizeTaskPromptNodes([
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
        { type: 'token', tokenKind: 'skill', id: 'skill-1', name: 'brainstorm', source: 'project', toolId: 'codex' },
        { type: 'text', text: '' }
      ])
    ).toEqual([
      { type: 'text', text: 'Hello world' },
      { type: 'token', tokenKind: 'skill', id: 'skill-1', name: 'brainstorm', source: 'project', toolId: 'codex' }
    ])
  })

  it('extracts only user-visible text from nodes', () => {
    const nodes: TaskPromptNode[] = [
      { type: 'text', text: 'Build a slash command UI' },
      { type: 'token', tokenKind: 'skill', id: 'skill-1', name: 'brainstorm', source: 'project', toolId: 'codex' },
      { type: 'text', text: '\nKeep it stable.' }
    ]

    expect(getTaskPromptVisibleText(nodes)).toBe('Build a slash command UI\nKeep it stable.')
  })

  it('treats tokens as valid content even when text is empty', () => {
    expect(
      hasTaskPromptContent([
        { type: 'token', tokenKind: 'mcp', id: 'mcp-1', name: 'github', source: 'project', toolId: 'codex' }
      ])
    ).toBe(true)
    expect(hasTaskPromptContent([{ type: 'text', text: '   ' }])).toBe(false)
  })

  it('compiles plain text without injecting empty sections', () => {
    expect(
      compileTaskPrompt([
        { type: 'text', text: 'Implement slash commands in task composer.' }
      ])
    ).toBe('Implement slash commands in task composer.')
  })

  it('compiles selected token names into a stable prompt template', () => {
    expect(
      compileTaskPrompt([
        { type: 'text', text: 'Implement slash commands in task composer.' },
        { type: 'token', tokenKind: 'skill', id: 'skill-1', name: 'brainstorm', source: 'project', toolId: 'codex' },
        { type: 'token', tokenKind: 'skill', id: 'skill-2', name: 'brainstorm', source: 'global', toolId: 'codex' },
        { type: 'token', tokenKind: 'mcp', id: 'mcp-1', name: 'github', source: 'project', toolId: 'codex' }
      ])
    ).toBe(
      [
        'Implement slash commands in task composer.',
        'Selected skills:\n- brainstorm',
        'Selected MCP servers:\n- github',
        'Use the selected skills and MCP servers if they are relevant and available in the current environment.'
      ].join('\n\n')
    )
  })

  it('replaces the document with plain text when needed', () => {
    expect(replaceTaskPromptWithText('Optimized prompt')).toEqual([
      { type: 'text', text: 'Optimized prompt' }
    ])
    expect(replaceTaskPromptWithText('')).toEqual([])
  })
})
