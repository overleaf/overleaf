import { debounce } from 'lodash'

export const positionItems = debounce(
  (
    element: HTMLDivElement,
    containerElement: HTMLDivElement,
    previousFocusedItemIndex: number
  ) => {
    const scrollRect = containerElement.getBoundingClientRect()

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
      focusedItemIndex = previousFocusedItemIndex
    }

    // TODO: editorPadding?
    const topDiff = scrollRect.top - 80

    const focusedItem = items[focusedItemIndex]
    if (!focusedItem) {
      return
    }
    const focusedItemTop = Number(focusedItem.dataset.top)
    focusedItem.style.top = `${focusedItemTop + topDiff}px`
    focusedItem.style.visibility = 'visible'
    const focusedItemRect = focusedItem.getBoundingClientRect()

    // above the focused item
    let topLimit = focusedItemTop
    for (let i = focusedItemIndex - 1; i >= 0; i--) {
      const item = items[i]
      const rect = item.getBoundingClientRect()
      let top = Number(item.dataset.top)
      const bottom = top + rect.height
      if (bottom > topLimit) {
        top = topLimit - rect.height - 10
      }
      item.style.top = `${top + topDiff}px`
      item.style.visibility = 'visible'
      topLimit = top
    }

    // below the focused item
    let bottomLimit = focusedItemTop + focusedItemRect.height
    for (let i = focusedItemIndex + 1; i < items.length; i++) {
      const item = items[i]
      const rect = item.getBoundingClientRect()
      let top = Number(item.dataset.top)
      if (top < bottomLimit) {
        top = bottomLimit + 10
      }
      item.style.top = `${top + topDiff}px`
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
