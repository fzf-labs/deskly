import { describe, expect, it } from 'vitest'

import type { LogMsg } from '../../../../src/renderer/src/features/cli-session'
import {
  buildClaudeCodeTimelineItems,
  buildCursorAgentTimelineItems,
  buildGeminiTimelineItems,
  buildOpencodeTimelineItems,
  parseClaudeCodeLogs,
  parseCursorAgentLogs,
  parseGeminiLogs,
  parseOpencodeLogs
} from '../../../../src/renderer/src/features/cli-session'

function stdout(content: string, timestamp: number, id: string): LogMsg {
  return {
    type: 'stdout',
    content,
    timestamp,
    id
  }
}

function finished(exitCode: number, timestamp: number, id: string): LogMsg {
  return {
    type: 'finished',
    exit_code: exitCode,
    timestamp,
    id
  }
}

describe('non-codex log timelines', () => {
  it('builds claude timeline items with paired tool results and status rows', () => {
    const logs: LogMsg[] = [
      stdout(
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: '我先检查测试状态。' },
              {
                type: 'tool_use',
                id: 'claude-tool-1',
                name: 'Bash',
                input: { command: 'pnpm test' }
              }
            ]
          }
        }),
        1000,
        'claude-1'
      ),
      stdout(
        JSON.stringify({
          type: 'user',
          message: {
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'claude-tool-1',
                content: 'test output'
              }
            ]
          }
        }),
        1010,
        'claude-2'
      ),
      stdout(
        JSON.stringify({
          type: 'result',
          subtype: 'success',
          duration_ms: 1200
        }),
        1020,
        'claude-3'
      )
    ]

    const items = buildClaudeCodeTimelineItems(parseClaudeCodeLogs(logs))

    expect(items.map((item) => item.type)).toEqual(['answer_block', 'process_block', 'status_block'])
    expect(items[1]?.type).toBe('process_block')
    if (items[1]?.type !== 'process_block') throw new Error('Expected process block')
    expect(items[1].kind).toBe('command')
    expect(items[1].relatedResult?.content).toBe('test output')
  })

  it('builds cursor timeline items and keeps result-only assistant content filtered', () => {
    const logs: LogMsg[] = [
      stdout(JSON.stringify({ type: 'user', message: { content: 'Read the file' } }), 2000, 'cursor-1'),
      stdout(JSON.stringify({ type: 'assistant', message: { content: '我先读取一下。' } }), 2010, 'cursor-2'),
      stdout(
        JSON.stringify({
          type: 'tool_call',
          subtype: 'started',
          call_id: 'cursor-tool-1',
          tool_call: {
            ReadFileToolCall: {
              args: {
                path: '/tmp/demo.ts'
              }
            }
          }
        }),
        2020,
        'cursor-3'
      ),
      stdout(
        JSON.stringify({
          type: 'tool_call',
          subtype: 'completed',
          call_id: 'cursor-tool-1',
          tool_call: {
            ReadFileToolCall: {
              result: {
                content: 'export const value = 1'
              }
            }
          }
        }),
        2030,
        'cursor-4'
      ),
      stdout(
        JSON.stringify({
          type: 'result',
          result: 'This should be filtered when normal assistant output exists.'
        }),
        2040,
        'cursor-5'
      )
    ]

    const entries = parseCursorAgentLogs(logs)
    const items = buildCursorAgentTimelineItems(entries)

    expect(entries.filter((entry) => entry.type === 'assistant_message')).toHaveLength(1)
    expect(items.map((item) => item.type)).toEqual(['user_bubble', 'answer_block', 'process_block'])
    expect(items[2]?.type).toBe('process_block')
    if (items[2]?.type !== 'process_block') throw new Error('Expected process block')
    expect(items[2].kind).toBe('file_read')
    expect(items[2].relatedResult?.content).toContain('export const value = 1')
  })

  it('merges gemini assistant messages into one answer block and preserves status rows', () => {
    const logs: LogMsg[] = [
      stdout(JSON.stringify({ role: 'user', text: 'Plan this change' }), 3000, 'gemini-1'),
      stdout(JSON.stringify({ role: 'model', text: 'Step one' }), 3010, 'gemini-2'),
      stdout(JSON.stringify({ role: 'assistant', text: 'Step two' }), 3020, 'gemini-3'),
      finished(0, 3030, 'gemini-4')
    ]

    const items = buildGeminiTimelineItems(parseGeminiLogs(logs))

    expect(items.map((item) => item.type)).toEqual(['user_bubble', 'answer_block', 'status_block'])
    expect(items[1]?.type).toBe('answer_block')
    if (items[1]?.type !== 'answer_block') throw new Error('Expected answer block')
    expect(items[1].content).toContain('Step one')
    expect(items[1].content).toContain('Step two')
  })

  it('builds opencode timeline items with paired tool output and explicit errors', () => {
    const logs: LogMsg[] = [
      stdout(JSON.stringify({ type: 'user', content: 'Open the project' }), 4000, 'op-1'),
      stdout(JSON.stringify({ type: 'assistant', content: '先看一下目录。' }), 4010, 'op-2'),
      stdout(
        JSON.stringify({
          type: 'tool_use',
          tool_name: 'Read',
          id: 'op-tool-1',
          input: {
            path: '/tmp/project/README.md'
          }
        }),
        4020,
        'op-3'
      ),
      stdout(
        JSON.stringify({
          type: 'tool_result',
          tool_use_id: 'op-tool-1',
          result: {
            content: '# README'
          }
        }),
        4030,
        'op-4'
      ),
      stdout(JSON.stringify({ type: 'error', message: 'permission denied' }), 4040, 'op-5')
    ]

    const items = buildOpencodeTimelineItems(parseOpencodeLogs(logs))

    expect(items.map((item) => item.type)).toEqual(['user_bubble', 'answer_block', 'process_block', 'error_block'])
    expect(items[2]?.type).toBe('process_block')
    if (items[2]?.type !== 'process_block') throw new Error('Expected process block')
    expect(items[2].kind).toBe('file_read')
    expect(items[2].relatedResult?.content).toContain('# README')
  })
})
