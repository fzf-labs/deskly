import { describe, expect, it } from 'vitest'

import type { LogMsg } from '../../../../src/renderer/src/features/cli-session'
import {
  buildCodexConversationTurns,
  buildCodexTimelineItems,
  parseCodexLogs
} from '../../../../src/renderer/src/features/cli-session'

function stdout(content: string, timestamp: number, id: string): LogMsg {
  return {
    type: 'stdout',
    content,
    timestamp,
    id
  }
}

describe('codex-log-model', () => {
  it('groups codex logs into user and assistant turns', () => {
    const logs: LogMsg[] = [
      stdout(JSON.stringify({ type: 'user_message', message: 'First prompt' }), 1000, '1'),
      stdout(JSON.stringify({ type: 'assistant_message', message: 'Hello' }), 1010, '2'),
      stdout(JSON.stringify({ type: 'agent_message_delta', delta: ' world' }), 1020, '3'),
      stdout(JSON.stringify({ type: 'exec_command_begin', command: ['pnpm', 'test'], call_id: 'cmd-1' }), 1030, '4'),
      stdout(JSON.stringify({ type: 'exec_command_end', call_id: 'cmd-1', exit_code: 0, stdout: 'ok' }), 1040, '5'),
      stdout(JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 20 } }), 1050, '6'),
      stdout(JSON.stringify({ type: 'user_message', message: 'Second prompt' }), 2000, '7'),
      stdout(JSON.stringify({ type: 'assistant_message', message: 'Done.' }), 2010, '8'),
      stdout(JSON.stringify({ type: 'turn.completed' }), 2020, '9')
    ]

    const entries = parseCodexLogs(logs)
    const turns = buildCodexConversationTurns(entries)

    expect(turns.map((turn) => turn.kind)).toEqual(['user', 'assistant', 'user', 'assistant'])

    const firstAssistantTurn = turns[1]
    expect(firstAssistantTurn.kind).toBe('assistant')
    if (firstAssistantTurn.kind !== 'assistant') {
      throw new Error('Expected assistant turn')
    }

    expect(firstAssistantTurn.body).toBe('Hello world')
    expect(firstAssistantTurn.completed).toBe(true)
    expect(firstAssistantTurn.processEntries.map((entry) => entry.type)).toEqual([
      'command_run',
      'tool_result',
      'system_message'
    ])
  })

  it('keeps raw non-json stdout as assistant-side narrative content', () => {
    const logs: LogMsg[] = [
      stdout('Drafted a plan for the next step.', 3000, '1'),
      stdout(JSON.stringify({ type: 'turn.completed' }), 3010, '2')
    ]

    const turns = buildCodexConversationTurns(parseCodexLogs(logs))

    expect(turns).toHaveLength(1)
    expect(turns[0]?.kind).toBe('assistant')

    const assistantTurn = turns[0]
    if (!assistantTurn || assistantTurn.kind !== 'assistant') {
      throw new Error('Expected assistant turn')
    }

    expect(assistantTurn.body).toBe('')
    expect(assistantTurn.narrativeEntries).toHaveLength(1)
    expect(assistantTurn.narrativeEntries[0]?.content).toBe('Drafted a plan for the next step.')
    expect(assistantTurn.processEntries).toHaveLength(1)
    expect(assistantTurn.processEntries[0]?.content).toBe('Turn completed')
  })

  it('parses todo list item events into structured system cards', () => {
    const logs: LogMsg[] = [
      stdout(
        JSON.stringify({
          type: 'item.completed',
          item: {
            id: 'todo-1',
            type: 'todo_list',
            items: [
              { text: 'Review parser', completed: true },
              { text: 'Polish UI', completed: false }
            ]
          }
        }),
        4000,
        'todo'
      )
    ]

    const entries = parseCodexLogs(logs)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.metadata?.codexCardType).toBe('todo_list')
    expect(entries[0]?.metadata?.todoCompletedCount).toBe(1)
    expect(entries[0]?.metadata?.todoTotalCount).toBe(2)
  })

  it('parses file change item events into structured system cards', () => {
    const logs: LogMsg[] = [
      stdout(
        JSON.stringify({
          type: 'item.completed',
          item: {
            id: 'file-1',
            type: 'file_change',
            changes: [
              { path: '/tmp/project/src/foo.ts', kind: 'update' },
              { path: '/tmp/project/src/bar.ts', kind: 'create' }
            ]
          }
        }),
        5000,
        'file'
      )
    ]

    const entries = parseCodexLogs(logs)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.metadata?.codexCardType).toBe('file_change')
    const changes = Array.isArray(entries[0]?.metadata?.codexChanges) ? entries[0]?.metadata?.codexChanges : []
    expect(changes).toHaveLength(2)
  })

  it('builds flat timeline items in the original readable order', () => {
    const entries = parseCodexLogs([
      stdout(JSON.stringify({ type: 'user_message', message: 'Check logs' }), 1000, '1'),
      stdout(JSON.stringify({ type: 'assistant_message', message: '我先看一下。' }), 1010, '2'),
      stdout(
        JSON.stringify({
          type: 'item.started',
          item: {
            id: 'cmd-1',
            type: 'command',
            command: 'tail -n 50 /tmp/app.log'
          }
        }),
        1020,
        '3'
      ),
      stdout(JSON.stringify({ type: 'assistant_message', message: '发现了一个明显错误。' }), 1030, '4'),
      stdout(JSON.stringify({ type: 'turn.completed' }), 1040, '5')
    ])

    const items = buildCodexTimelineItems(entries)

    expect(items.map((item) => item.type === 'user_bubble' ? item.type : item.kind)).toEqual([
      'user_bubble',
      'answer_markdown',
      'command_collapsible',
      'answer_markdown',
      'system_status'
    ])
  })

  it('captures reasoning as a dedicated thinking block', () => {
    const entries = parseCodexLogs([
      stdout(JSON.stringify({ type: 'reasoning', text: '先确认最近的日志和报错模式。' }), 2000, 'r1')
    ])

    const items = buildCodexTimelineItems(entries)
    expect(items).toHaveLength(1)
    expect(items[0]?.type).toBe('assistant_block')
    if (!items[0] || items[0].type !== 'assistant_block' || items[0].kind === 'answer_markdown' || items[0].kind === 'error_block') {
      throw new Error('Expected process block')
    }
    expect(items[0].kind).toBe('thinking_collapsible')
  })

  it('maps write-like tool calls to file create collapsible rows', () => {
    const entries = parseCodexLogs([
      stdout(
        JSON.stringify({
          type: 'item.started',
          item: {
            id: 'write-1',
            type: 'tool_call',
            tool_name: 'Write',
            input: {
              path: '/tmp/new-file.ts'
            }
          }
        }),
        3000,
        'w1'
      )
    ])

    const items = buildCodexTimelineItems(entries)
    expect(items).toHaveLength(1)
    expect(items[0]?.type).toBe('assistant_block')
    if (!items[0] || items[0].type !== 'assistant_block' || items[0].kind === 'answer_markdown' || items[0].kind === 'error_block') {
      throw new Error('Expected process block')
    }
    expect(items[0].kind).toBe('file_create_collapsible')
  })

  it('maps file_change cards to create or edit rows with compact path summaries', () => {
    const entries = parseCodexLogs([
      stdout(
        JSON.stringify({
          type: 'item.completed',
          item: {
            id: 'create-1',
            type: 'file_change',
            changes: [
              { path: '/tmp/project/src/renderer/new-file.tsx', kind: 'create' },
              { path: '/tmp/project/src/renderer/another-file.tsx', kind: 'add' }
            ]
          }
        }),
        4000,
        'fc1'
      ),
      stdout(
        JSON.stringify({
          type: 'item.completed',
          item: {
            id: 'edit-1',
            type: 'file_change',
            changes: [
              { path: '/tmp/project/src/renderer/existing-file.tsx', kind: 'update' }
            ]
          }
        }),
        4010,
        'fc2'
      )
    ])

    const items = buildCodexTimelineItems(entries)
    expect(items).toHaveLength(2)

    const createItem = items[0]
    const editItem = items[1]

    if (!createItem || createItem.type !== 'assistant_block' || createItem.kind === 'answer_markdown' || createItem.kind === 'error_block') {
      throw new Error('Expected create process block')
    }

    if (!editItem || editItem.type !== 'assistant_block' || editItem.kind === 'answer_markdown' || editItem.kind === 'error_block') {
      throw new Error('Expected edit process block')
    }

    expect(createItem.kind).toBe('file_create_collapsible')
    expect(createItem.title).toBe('创建文件')
    expect(createItem.summary).toContain('renderer/new-file.tsx')
    expect(createItem.summary).toContain('2 个文件')

    expect(editItem.kind).toBe('file_edit_collapsible')
    expect(editItem.title).toBe('编辑文件')
    expect(editItem.summary).toBe('project/src/renderer/existing-file.tsx')
  })
})
