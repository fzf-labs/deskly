import { describe, expect, it } from 'vitest'

import { ClaudeCodeAdapter } from '../../src/main/services/cli/adapters/ClaudeCodeAdapter'
import { CodexCliAdapter } from '../../src/main/services/cli/adapters/CodexCliAdapter'
import { CursorAgentAdapter } from '../../src/main/services/cli/adapters/CursorAgentAdapter'
import { GeminiCliAdapter } from '../../src/main/services/cli/adapters/GeminiCliAdapter'
import { OpencodeAdapter } from '../../src/main/services/cli/adapters/OpencodeAdapter'

const baseOptions = {
  sessionId: 'session-1',
  toolId: 'tool',
  workdir: '/tmp/workdir',
  prompt: 'Implement the requested change'
}

describe('CLI adapter argv builders', () => {
  it('builds claude args from canonical snake_case config', () => {
    const adapter = new ClaudeCodeAdapter({
      getConfig: () => ({ executablePath: 'claude' })
    } as never)

    const spec = adapter.buildCommandSpec({
      ...baseOptions,
      toolId: 'claude-code',
      toolConfig: {
        model: 'sonnet',
        agent: 'reviewer',
        agents: '{"reviewer":{"description":"Review"}}',
        add_dir: ['/repo/extra'],
        allowed_tools: ['Read', 'Edit'],
        append_system_prompt: 'be concise',
        permission_mode: 'plan',
        mcp_config: ['/tmp/mcp.json'],
        strict_mcp_config: true,
        setting_sources: 'user,project',
        include_partial_messages: true,
        replay_user_messages: true,
        no_session_persistence: true,
        fallback_model: 'opus',
        max_budget_usd: '2.50',
        json_schema: '{"type":"object"}',
        file_resources: ['file_123:notes.txt'],
        no_chrome: true,
        plugin_dir: ['/tmp/plugins']
      }
    })

    expect(spec.command).toContain('claude')
    expect(spec.args).toContain('--agent')
    expect(spec.args).toContain('reviewer')
    expect(spec.args).toContain('--agents')
    expect(spec.args).toContain('{"reviewer":{"description":"Review"}}')
    expect(spec.args).toContain('--add-dir')
    expect(spec.args).toContain('/repo/extra')
    expect(spec.args).toContain('--allowed-tools')
    expect(spec.args).toContain('Read,Edit')
    expect(spec.args).toContain('--append-system-prompt')
    expect(spec.args).toContain('be concise')
    expect(spec.args).toContain('--permission-mode')
    expect(spec.args).toContain('plan')
    expect(spec.args).toContain('--mcp-config')
    expect(spec.args).toContain('/tmp/mcp.json')
    expect(spec.args).toContain('--strict-mcp-config')
    expect(spec.args).toContain('--setting-sources')
    expect(spec.args).toContain('user,project')
    expect(spec.args).toContain('--include-partial-messages')
    expect(spec.args).toContain('--replay-user-messages')
    expect(spec.args).toContain('--no-session-persistence')
    expect(spec.args).toContain('--fallback-model')
    expect(spec.args).toContain('opus')
    expect(spec.args).toContain('--max-budget-usd')
    expect(spec.args).toContain('2.50')
    expect(spec.args).toContain('--json-schema')
    expect(spec.args).toContain('{"type":"object"}')
    expect(spec.args).toContain('--file')
    expect(spec.args).toContain('file_123:notes.txt')
    expect(spec.args).toContain('--no-chrome')
    expect(spec.args).toContain('--plugin-dir')
    expect(spec.args).toContain('/tmp/plugins')
  })

  it('builds codex exec args from canonical snake_case config', () => {
    const adapter = new CodexCliAdapter()

    const spec = adapter.buildCommandSpec({
      ...baseOptions,
      toolId: 'codex',
      toolConfig: {
        model: 'gpt-5',
        config_overrides: ['model="gpt-5"'],
        enable_features: ['alpha'],
        disable_features: ['beta'],
        image_paths: ['/tmp/image.png'],
        ask_for_approval: 'never',
        full_auto: true,
        dangerously_bypass_approvals_and_sandbox: true,
        local_provider: 'ollama',
        search: true,
        add_dir: ['/tmp/extra'],
        no_alt_screen: true,
        skip_git_repo_check: true,
        ephemeral: true,
        output_schema: '/tmp/schema.json',
        color: 'never',
        progress_cursor: true,
        output_last_message: '/tmp/last.txt',
        thread_id: 'thread-123'
      }
    })

    expect(spec.args).toEqual(
      expect.arrayContaining([
        '-c',
        'model="gpt-5"',
        '--enable',
        'alpha',
        '--disable',
        'beta',
        '-i',
        '/tmp/image.png',
        '--ask-for-approval',
        'never',
        '--full-auto',
        '--dangerously-bypass-approvals-and-sandbox',
        '--local-provider',
        'ollama',
        '--search',
        '--add-dir',
        '/tmp/extra',
        '--no-alt-screen',
        'exec',
        'resume',
        '--skip-git-repo-check',
        '--ephemeral',
        '--output-schema',
        '/tmp/schema.json',
        '--color',
        'never',
        '--progress-cursor',
        '--json',
        '--output-last-message',
        '/tmp/last.txt',
        '-m',
        'gpt-5',
        'thread-123',
        '-'
      ])
    )
  })

  it('builds cursor args from canonical snake_case config', () => {
    const adapter = new CursorAgentAdapter()

    const spec = adapter.buildCommandSpec({
      ...baseOptions,
      toolId: 'cursor-agent',
      toolConfig: {
        api_key: 'secret',
        force: true,
        yolo: true,
        model: 'gpt-5',
        mode: 'plan',
        plan: true,
        sandbox: 'enabled',
        trust: true,
        workspace: '/tmp/workspace',
        header: ['X-Test: 1'],
        approve_mcps: true,
        worktree: 'feature-branch',
        worktree_base: 'main',
        skip_worktree_setup: true
      }
    })

    expect(spec.args).toEqual(
      expect.arrayContaining([
        '-p',
        '--output-format=stream-json',
        '--api-key',
        'secret',
        '--force',
        '--yolo',
        '--model',
        'gpt-5',
        '--mode',
        'plan',
        '--plan',
        '--sandbox',
        'enabled',
        '--trust',
        '--workspace',
        '/tmp/workspace',
        '--header',
        'X-Test: 1',
        '--approve-mcps',
        '--worktree',
        'feature-branch',
        '--worktree-base',
        'main',
        '--skip-worktree-setup',
        'Implement the requested change'
      ])
    )
  })

  it('builds gemini args from canonical snake_case config', () => {
    const adapter = new GeminiCliAdapter()

    const spec = adapter.buildCommandSpec({
      ...baseOptions,
      toolId: 'gemini-cli',
      toolConfig: {
        model: 'gemini-2.5-pro',
        sandbox: true,
        yolo: true,
        approval_mode: 'plan',
        policy: ['/tmp/policy.md'],
        acp: true,
        allowed_mcp_server_names: ['github'],
        allowed_tools: ['Read'],
        extensions: ['repo-tools'],
        resume: 'latest',
        include_directories: ['/tmp/extra'],
        output_format: 'stream-json',
        raw_output: true,
        accept_raw_output_risk: true,
        debug: true
      }
    })

    expect(spec.args).toEqual(
      expect.arrayContaining([
        '--model',
        'gemini-2.5-pro',
        '--sandbox',
        '--yolo',
        '--approval-mode',
        'plan',
        '--policy',
        '/tmp/policy.md',
        '--acp',
        '--allowed-mcp-server-names',
        'github',
        '--allowed-tools',
        'Read',
        '--extensions',
        'repo-tools',
        '--resume',
        'latest',
        '--include-directories',
        '/tmp/extra',
        '--output-format',
        'stream-json',
        '--raw-output',
        '--accept-raw-output-risk',
        '--debug'
      ])
    )
  })

  it('builds opencode args from canonical snake_case config', () => {
    const adapter = new OpencodeAdapter()

    const spec = adapter.buildCommandSpec({
      ...baseOptions,
      toolId: 'opencode',
      toolConfig: {
        model: 'openai/gpt-5',
        continue: true,
        session: 'session-42',
        agent: 'planner',
        print_logs: true,
        log_level: 'DEBUG',
        port: '4321',
        hostname: '0.0.0.0',
        mdns: true,
        mdns_domain: 'deskly.local',
        cors: ['http://localhost:3333']
      }
    })

    expect(spec.args).toEqual(
      expect.arrayContaining([
        '--model',
        'openai/gpt-5',
        '--session',
        'session-42',
        '--agent',
        'planner',
        '--print-logs',
        '--log-level',
        'DEBUG',
        '--port',
        '4321',
        '--hostname',
        '0.0.0.0',
        '--mdns',
        '--mdns-domain',
        'deskly.local',
        '--cors',
        'http://localhost:3333'
      ])
    )
  })
})
