import { describe, expect, it } from 'vitest'

import {
  isProjectRequiredRoute,
  normalizeCurrentProjectId
} from '../../src/renderer/src/features/projects'

describe('isProjectRequiredRoute', () => {
  it('matches project-scoped top-level routes', () => {
    expect(isProjectRequiredRoute('/dashboard')).toBe(true)
    expect(isProjectRequiredRoute('/board')).toBe(true)
    expect(isProjectRequiredRoute('/automations')).toBe(true)
    expect(isProjectRequiredRoute('/pipeline-templates')).toBe(true)
    expect(isProjectRequiredRoute('/skills')).toBe(true)
    expect(isProjectRequiredRoute('/mcp')).toBe(true)
  })

  it('matches nested project-scoped routes', () => {
    expect(isProjectRequiredRoute('/pipeline-templates/editor', '?scope=project')).toBe(true)
  })

  it('ignores non project-scoped routes', () => {
    expect(isProjectRequiredRoute('/tasks')).toBe(false)
    expect(isProjectRequiredRoute('/home')).toBe(false)
    expect(isProjectRequiredRoute('/task/123')).toBe(false)
    expect(isProjectRequiredRoute('/settings')).toBe(false)
    expect(isProjectRequiredRoute('/settings', '?tab=projects')).toBe(false)
    expect(isProjectRequiredRoute('/pipeline-templates/editor', '?scope=global')).toBe(false)
  })
})

describe('normalizeCurrentProjectId', () => {
  const projects = [{ id: 'alpha' }, { id: 'beta' }]

  it('keeps an existing project selection', () => {
    expect(normalizeCurrentProjectId('alpha', projects)).toBe('alpha')
  })

  it('clears a missing project selection', () => {
    expect(normalizeCurrentProjectId('missing', projects)).toBeNull()
  })

  it('keeps an empty selection empty', () => {
    expect(normalizeCurrentProjectId(null, projects)).toBeNull()
  })
})
