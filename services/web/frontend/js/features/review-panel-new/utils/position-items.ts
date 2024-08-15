import { debounce } from 'lodash'

const COLLAPSED_HEADER_HEIGHT = 75
const OFFSET_FOR_ENTRIES_ABOVE = 70

export const positionItems = debounce(
  (element: HTMLDivElement, previousFocusedItemIndex: number) => {
    const items = Array.from(
      element.querySelectorAll<HTMLDivElement>('.review-panel-entry')
    )

    items.sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos))

    if (!items.length) {
      return
    }

    let focusedItemIndex = items.findIndex(item =>
      item.classList.contains('review-panel-entry-focused')
    )
    if (focusedItemIndex === -1) {
      // if entry was not focused manually
      // check if there is an entry in selection and use that as the focused item
      focusedItemIndex = items.findIndex(item =>
        item.classList.contains('review-panel-entry-highlighted')
      )
    }
    if (focusedItemIndex === -1) {
      focusedItemIndex = previousFocusedItemIndex
    }

    const focusedItem = items[focusedItemIndex]
    if (!focusedItem) {
      return
    }

    const focusedItemTop = getTopPosition(focusedItem, focusedItemIndex === 0)

    focusedItem.style.top = `${focusedItemTop}px`
    focusedItem.style.visibility = 'visible'
    const focusedItemRect = focusedItem.getBoundingClientRect()

    // above the focused item
    let topLimit = focusedItemTop
    for (let i = focusedItemIndex - 1; i >= 0; i--) {
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

    // below the focused item
    let bottomLimit = focusedItemTop + focusedItemRect.height
    for (let i = focusedItemIndex + 1; i < items.length; i++) {
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
      focusedItemIndex,
      min: topLimit,
      max: bottomLimit,
    }
  },
  100,
  { leading: false, trailing: true, maxWait: 1000 }
)

function getTopPosition(item: HTMLDivElement, isFirstEntry: boolean) {
  const offset = isFirstEntry ? 0 : OFFSET_FOR_ENTRIES_ABOVE
  return Math.max(COLLAPSED_HEADER_HEIGHT + offset, Number(item.dataset.top))
}
