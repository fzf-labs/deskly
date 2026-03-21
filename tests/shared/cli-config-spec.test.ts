import { describe, expect, it } from 'vitest'

import {
  createCliToolConfigTemplate,
  listCliToolConfigKeys,
  normalizeCliToolConfig
} from '../../src/shared/cli-config-spec'

describe('cli config spec', () => {
  it('exposes canonical codex keys and excludes removed legacy fields', () => {
    const keys = listCliToolConfigKeys('codex')

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

  it('creates templates from the shared spec only', () => {
    const template = createCliToolConfigTemplate('opencode')

    expect(template).toHaveProperty('print_logs', null)
    expect(template).toHaveProperty('log_level', '')
    expect(template).not.toHaveProperty('variant')
    expect(template).not.toHaveProperty('auto_approve')
  })
})
