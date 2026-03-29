const SELECTED_SLASH_ITEM_SELECTOR = '[data-slash-selected="true"]'

interface QueryableContainer {
  querySelector(selectors: string): Element | null
}

export const scrollSelectedSlashItemIntoView = (container: QueryableContainer | null) => {
  const selectedItem = container?.querySelector(SELECTED_SLASH_ITEM_SELECTOR)
  const scrollableItem = selectedItem as (Element & {
    scrollIntoView?: (options?: ScrollIntoViewOptions) => void
  }) | null

  if (!scrollableItem || typeof scrollableItem.scrollIntoView !== 'function') {
    return
  }

  scrollableItem.scrollIntoView({
    block: 'nearest'
  })
}
