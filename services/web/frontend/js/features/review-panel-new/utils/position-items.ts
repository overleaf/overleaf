import { debounce } from 'lodash'

const COLLAPSED_HEADER_HEIGHT = 75
const OFFSET_FOR_ENTRIES_ABOVE = 70

export const positionItems = debounce(
  (
    element: HTMLDivElement,
    previousFocusedItemIndex: number,
    docId: string
  ) => {
    const items = Array.from(
      element.querySelectorAll<HTMLDivElement>('.review-panel-entry')
    )

    items.sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos))

    if (!items.length) {
      return
    }

    let activeItemIndex = items.findIndex(item =>
      item.classList.contains('review-panel-entry-action')
    )

    if (activeItemIndex === -1) {
      // if there is no action available
      // check if there is a focused entry
      activeItemIndex = items.findIndex(item =>
        item.classList.contains('review-panel-entry-focused')
      )
    }

    if (activeItemIndex === -1) {
      // if entry was not focused manually
      // check if there is an entry in selection and use that as the focused item
      activeItemIndex = items.findIndex(item =>
        item.classList.contains('review-panel-entry-highlighted')
      )
    }

    if (activeItemIndex === -1) {
      activeItemIndex = previousFocusedItemIndex
    }

    const activeItem = items[activeItemIndex]
    if (!activeItem) {
      return
    }

    const activeItemTop = getTopPosition(activeItem, activeItemIndex === 0)

    activeItem.style.top = `${activeItemTop}px`
    activeItem.style.visibility = 'visible'
    const focusedItemRect = activeItem.getBoundingClientRect()

    // above the active item
    let topLimit = activeItemTop
    for (let i = activeItemIndex - 1; i >= 0; i--) {
      const item = items[i]
      const rect = item.getBoundingClientRect()
      let top = getTopPosition(item, i === 0)
      const bottom = top + rect.height
      if (bottom > topLimit) {
        top = topLimit - rect.height - 10
      }
      item.style.top = `${top}px`
      item.style.visibility = 'visible'
      topLimit = top
    }

    // below the active item
    let bottomLimit = activeItemTop + focusedItemRect.height
    for (let i = activeItemIndex + 1; i < items.length; i++) {
      const item = items[i]
      const rect = item.getBoundingClientRect()
      let top = getTopPosition(item, false)
      if (top < bottomLimit) {
        top = bottomLimit + 10
      }
      item.style.top = `${top}px`
      item.style.visibility = 'visible'
      bottomLimit = top + rect.height
    }

    return {
      docId,
      activeItemIndex,
    }
  },
  100,
  { leading: false, trailing: true, maxWait: 1000 }
)

function getTopPosition(item: HTMLDivElement, isFirstEntry: boolean) {
  const offset = isFirstEntry ? 0 : OFFSET_FOR_ENTRIES_ABOVE
  return Math.max(COLLAPSED_HEADER_HEIGHT + offset, Number(item.dataset.top))
}
