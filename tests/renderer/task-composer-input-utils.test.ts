import { describe, expect, it, vi } from 'vitest'

import { scrollSelectedSlashItemIntoView } from '../../src/renderer/src/features/tasks/ui/task-composer-input-utils'

describe('task-composer-input-utils', () => {
  it('scrolls the selected slash item into view', () => {
    const scrollIntoView = vi.fn()
    const selectedItem = {
      scrollIntoView
    } as unknown as Element
    const querySelector = vi.fn().mockReturnValue(selectedItem)

    scrollSelectedSlashItemIntoView({
      querySelector
    })

    expect(querySelector).toHaveBeenCalledWith('[data-slash-selected="true"]')
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest'
    })
  })

  it('does nothing when there is no selected slash item', () => {
    const querySelector = vi.fn().mockReturnValue(null)

    expect(() =>
      scrollSelectedSlashItemIntoView({
        querySelector
      })
    ).not.toThrow()
    expect(querySelector).toHaveBeenCalledWith('[data-slash-selected="true"]')
  })
})
