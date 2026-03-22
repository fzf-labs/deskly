import { describe, expect, it } from 'vitest'

import {
  createCliToolConfigTemplate,
  getVisibleCliToolConfigSpec,
  listCliToolConfigKeys,
  normalizeCliToolConfig
} from '../../src/shared/agent-cli-config-spec'

describe('cli config spec', () => {
  it('exposes canonical codex keys and excludes removed legacy fields', () => {
    const keys = listCliToolConfigKeys('codex')

    expect(keys).toContain('reasoning_effort')
    expect(keys).toContain('config_overrides')
    expect(keys).toContain('enable_features')
    expect(keys).toContain('output_schema')
    expect(keys).not.toContain('model_reasoning_effort')
    expect(keys).not.toContain('developer_instructions')
  })

  it('normalizes aliases to canonical snake_case keys and drops unsupported fields', () => {
    const normalized = normalizeCliToolConfig('claude-code', {
      agentsJson: '{"reviewer":{"description":"Review"}}',
      allowedTools: ['Read', 'Edit'],
      appendSystemPrompt: 'extra system',
      disable_api_key: true,
      approvals: true,
      plan: true
    })

    expect(normalized).toEqual({
      agents: '{"reviewer":{"description":"Review"}}',
      allowed_tools: ['Read', 'Edit'],
      append_system_prompt: 'extra system',
      permission_mode: 'plan'
    })
  })

  it('expands codex permissions preset into sandbox and approval settings', () => {
    const normalized = normalizeCliToolConfig('codex', {
      permissions_preset: 'default'
    })

    expect(normalized).toMatchObject({
      permissions_preset: 'default',
      sandbox: 'workspace-write',
      ask_for_approval: 'on-request'
    })
  })

  it('creates templates from the shared spec only', () => {
    const template = createCliToolConfigTemplate('opencode')

    expect(template).toHaveProperty('print_logs', null)
    expect(template).toHaveProperty('log_level', '')
    expect(template).not.toHaveProperty('variant')
    expect(template).not.toHaveProperty('auto_approve')
  })

  it('seeds codex templates with exec-friendly defaults', () => {
    const template = createCliToolConfigTemplate('codex')

    expect(template).toMatchObject({
      model: 'gpt-5.4',
      reasoning_effort: 'high',
      permissions_preset: 'custom',
      sandbox: 'workspace-write',
      ask_for_approval: 'never'
    })
  })

  it('shows only the essential codex fields in the settings UI schema', () => {
    const visibleFields = Object.keys(getVisibleCliToolConfigSpec('codex'))

    expect(visibleFields).toEqual([
      'model',
      'reasoning_effort',
      'permissions_preset',
      'sandbox',
      'ask_for_approval',
      'profile',
      'config_overrides'
    ])
  })
})
