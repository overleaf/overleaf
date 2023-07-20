import { useEffect, useRef } from 'react'
import { useLayoutContext } from '../../../../shared/context/layout-context'
import {
  ReviewPanelEntry,
  ReviewPanelEntryScreenPos,
} from '../../../../../../types/review-panel/entry'
import { debugConsole } from '../../../../utils/debugging'
import { useReviewPanelValueContext } from '../../context/review-panel/review-panel-context'
import useEventListener from '../../../../shared/hooks/use-event-listener'
import { ReviewPanelDocEntries } from '../../../../../../types/review-panel/review-panel'
import { dispatchReviewPanelLayout } from '../../extensions/changes/change-manager'
import { isEqual } from 'lodash'

type Positions = {
  entryTop: number
  callout: { top: number; height: number; inverted: boolean }
}

type EntryView = {
  entryId: keyof ReviewPanelDocEntries
  wrapper: HTMLElement
  indicator: HTMLElement | null
  box: HTMLElement
  callout: HTMLElement
  layout: HTMLElement
  height: number
  previousEntryTop: number | null
  previousCalloutTop: number | null
  entry: ReviewPanelEntry
  visible: boolean
  positions?: Positions
}

type EntryPositions = Pick<EntryView, 'entryId' | 'positions'>

type LayoutInfo = {
  focusedEntryIndex: number
  overflowTop: number
  height: number
  positions: EntryPositions[]
}

function css(el: HTMLElement, props: React.CSSProperties) {
  Object.assign(el.style, props)
}

function applyEntryVisibility(entryView: EntryView) {
  const visible = !!entryView.entry.screenPos
  entryView.wrapper.classList.toggle('rp-entry-hidden', !visible)
  return visible
}

function calculateCalloutPosition(
  screenPos: ReviewPanelEntryScreenPos,
  entryTop: number,
  lineHeight: number
) {
  const height = screenPos.height ?? lineHeight
  const originalTop = screenPos.y
  const inverted = entryTop <= originalTop
  return {
    top: inverted ? entryTop + height : originalTop + height - 1,
    height: Math.abs(entryTop - originalTop),
    inverted,
  }
}

function positionsEqual(
  entryPos1: EntryPositions[],
  entryPos2: EntryPositions[]
) {
  return isEqual(entryPos1, entryPos2)
}

const calculateEntryViewPositions = (
  entryViews: EntryView[],
  lineHeight: number,
  calculateTop: (originalTop: number, height: number) => number
) => {
  for (const entryView of entryViews) {
    const entryVisible = applyEntryVisibility(entryView)
    if (entryVisible) {
      const entryTop = calculateTop(
        entryView.entry.screenPos.y,
        entryView.height
      )
      const callout = calculateCalloutPosition(
        entryView.entry.screenPos,
        entryTop,
        lineHeight
      )
      entryView.positions = {
        entryTop,
        callout,
      }
    }
    debugConsole.log('ENTRY', { entry: entryView.entry, top })
  }
}

type PositionedEntriesProps = {
  entries: Array<[keyof ReviewPanelDocEntries, ReviewPanelEntry]>
  contentHeight: number
  children: React.ReactNode
}

function PositionedEntries({
  entries,
  contentHeight,
  children,
}: PositionedEntriesProps) {
  const { navHeight, toolbarHeight, lineHeight } = useReviewPanelValueContext()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { reviewPanelOpen } = useLayoutContext()
  const animationTimerRef = useRef<number | null>(null)
  const previousLayoutInfoRef = useRef<LayoutInfo>({
    focusedEntryIndex: 0,
    overflowTop: 0,
    height: 0,
    positions: [],
  })

  const layout = () => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const padding = reviewPanelOpen ? 8 : 4
    const toolbarPaddedHeight = reviewPanelOpen ? toolbarHeight + 6 : 0
    const navPaddedHeight = reviewPanelOpen ? navHeight + 4 : 0

    // Create a list of entry views, typing together DOM elements and model.
    // No measuring or style change is done at this point.
    const entryViews: EntryView[] = []

    // TODO: Look into tying the entry to the DOM element without going via a DOM data attribute
    for (const wrapper of container.querySelectorAll<HTMLElement>(
      '.rp-entry-wrapper'
    )) {
      const entryId = wrapper.dataset.entryId as
        | EntryView['entryId']
        | undefined
      if (!entryId) {
        throw new Error('Could not find an entry ID')
      }

      const entry = entries.find(value => value[0] === entryId)?.[1]
      if (!entry) {
        throw new Error(`Could not find an entry for ID ${entryId}`)
      }

      const indicator = wrapper.querySelector<HTMLElement>(
        '.rp-entry-indicator'
      )
      const box = wrapper.querySelector<HTMLElement>('.rp-entry')
      const callout = wrapper.querySelector<HTMLElement>('.rp-entry-callout')
      const layoutElement = reviewPanelOpen ? box : indicator

      if (box && callout && layoutElement) {
        const previousEntryTopData = box.dataset.previousEntryTop
        const previousCalloutTopData = callout.dataset.previousEntryTop
        entryViews.push({
          entryId,
          wrapper,
          indicator,
          box,
          callout,
          layout: layoutElement,
          visible: !!entry.screenPos,
          height: 0,
          previousEntryTop:
            previousEntryTopData !== undefined
              ? parseInt(previousEntryTopData)
              : null,
          previousCalloutTop:
            previousCalloutTopData !== undefined
              ? parseInt(previousCalloutTopData)
              : null,
          entry,
        })
      } else {
        debugConsole.log(
          'Entry wrapper is missing indicator, box or callout, so ignoring',
          wrapper
        )
      }
    }

    if (entryViews.length === 0) {
      return
    }

    entryViews.sort((a, b) => a.entry.offset - b.entry.offset)

    // Do the DOM interaction in three phases:
    //
    // - Apply the `display` property to all elements whose visibility has
    //   changed. This needs to happen first in order to measure heights.
    // - Measure the height of each entry
    // - Move each entry without animation to their original position
    //   relative to the editor content
    // - In the next animation frame, re-enable animation and position each
    //   entry
    //
    // The idea is to batch DOM reads and writes to avoid layout thrashing. In
    // this case, the best we can do is a write phase, a read phase then a
    // final write phase.
    // See https://web.dev/avoid-large-complex-layouts-and-layout-thrashing/

    // First, update visibility for each entry that needs it
    for (const entryView of entryViews) {
      entryView.wrapper.classList.toggle('rp-entry-hidden', !entryView.visible)
    }

    // Next, measure the height of each entry
    for (const entryView of entryViews) {
      if (entryView.visible) {
        entryView.height = entryView.layout.offsetHeight
      }
    }

    // Calculate positions for all visible entries
    let focusedEntryIndex = entryViews.findIndex(view => view.entry.focused)
    if (focusedEntryIndex === -1) {
      focusedEntryIndex = Math.min(
        previousLayoutInfoRef.current.focusedEntryIndex,
        entryViews.length - 1
      )
    }

    const focusedEntryView = entryViews[focusedEntryIndex]
    if (!focusedEntryView.entry.screenPos) {
      return
    }

    // If the focused entry has no screenPos, we can't position other
    // entryViews relative to it, so we position all other entryViews as
    // though the focused entry is at the top and the rest follow it
    const entryViewsAfter = focusedEntryView.visible
      ? entryViews.slice(focusedEntryIndex + 1)
      : [...entryViews]
    const entryViewsBefore = focusedEntryView.visible
      ? entryViews.slice(0, focusedEntryIndex).reverse() // Work through backwards, starting with the one just above
      : []

    debugConsole.log('focusedEntryIndex', focusedEntryIndex)

    let lastEntryBottom = 0
    let firstEntryTop = 0

    // Put the focused entry as close to where it wants to be as possible
    if (focusedEntryView.visible) {
      const focusedEntryScreenPos = focusedEntryView.entry.screenPos
      const entryTop = Math.max(focusedEntryScreenPos.y, toolbarPaddedHeight)
      const callout = calculateCalloutPosition(
        focusedEntryScreenPos,
        entryTop,
        lineHeight
      )
      focusedEntryView.positions = {
        entryTop,
        callout,
      }
      lastEntryBottom = entryTop + focusedEntryView.height
      firstEntryTop = entryTop
    }

    // Calculate positions for entries that are below the focused entry
    calculateEntryViewPositions(
      entryViewsAfter,
      lineHeight,
      (originalTop: number, height: number) => {
        const top = Math.max(originalTop, lastEntryBottom + padding)
        lastEntryBottom = top + height
        return top
      }
    )

    // Calculate positions for entries that are above the focused entry
    calculateEntryViewPositions(
      entryViewsBefore,
      lineHeight,
      (originalTop: number, height: number) => {
        const originalBottom = originalTop + height
        const bottom = Math.min(originalBottom, firstEntryTop - padding)
        const top = bottom - height
        firstEntryTop = top
        return top
      }
    )

    // Calculate the new top overflow
    const overflowTop = Math.max(0, toolbarPaddedHeight - firstEntryTop)

    // Position everything where it was before, taking into account the new top
    // overflow
    const moveEntriesToInitialPosition = () => {
      // Prevent CSS animation of position for this phase
      container.classList.add('no-animate')
      for (const entryView of entryViews) {
        const { callout: calloutEl, positions } = entryView
        if (positions) {
          const { entryTop, callout } = positions

          // Position the main wrapper in its original position, if it had
          // one, or its new position otherwise
          const entryTopInitial =
            entryView.previousEntryTop === null
              ? entryTop
              : entryView.previousEntryTop

          css(entryView.box, {
            top: entryTopInitial + overflowTop + 'px',
            // The entry element is invisible by default, to avoid flickering
            // when positioning for the first time. Here we make sure it becomes
            // visible after having a "top" value.
            visibility: 'visible',
          })

          if (entryView.indicator) {
            entryView.indicator.style.top = entryTopInitial + overflowTop + 'px'
          }

          entryView.box.dataset.previousEntryTop = entryTopInitial + ''

          // Position the callout element in its original position, if it had
          // one, or its new position otherwise
          calloutEl.classList.toggle(
            'rp-entry-callout-inverted',
            callout.inverted
          )
          const calloutTopInitial =
            entryView.previousCalloutTop === null
              ? callout.top
              : entryView.previousCalloutTop

          css(calloutEl, {
            top: calloutTopInitial + overflowTop + 'px',
            height: callout.height + 'px',
          })

          entryView.box.dataset.previousCalloutTop = calloutTopInitial + ''
        }
      }
    }

    const moveToFinalPositions = () => {
      // Re-enable CSS animation of position for this phase
      container.classList.remove('no-animate')

      for (const entryView of entryViews) {
        const { callout: calloutEl, positions } = entryView
        if (positions) {
          const { entryTop, callout } = positions

          // Position the main wrapper, if it's moved
          if (entryView.previousEntryTop !== entryTop) {
            entryView.box.style.top = entryTop + overflowTop + 'px'
          }
          entryView.box.dataset.previousEntryTop = entryTop + ''

          if (entryView.indicator) {
            entryView.indicator.style.top = entryTop + overflowTop + 'px'
          }

          // Position the callout element
          if (entryView.previousCalloutTop !== callout.top) {
            calloutEl.style.top = callout.top + overflowTop + 'px'
            entryView.callout.dataset.previousCalloutTop = callout.top + ''
          }
        }
      }

      animationTimerRef.current = null
    }

    // Check whether the positions of any entry have changed since the last
    // layout
    const positions = entryViews.map(
      (entryView): EntryPositions => ({
        entryId: entryView.entryId,
        positions: entryView.positions,
      })
    )

    const positionsChanged = !positionsEqual(
      previousLayoutInfoRef.current.positions,
      positions
    )

    // Check whether the top overflow or review panel height have changed
    const overflowTopChanged =
      overflowTop !== previousLayoutInfoRef.current.overflowTop

    const height = lastEntryBottom + navPaddedHeight
    const heightChanged = height !== previousLayoutInfoRef.current.height

    // Move entries into their initial positions
    if (positionsChanged || overflowTopChanged) {
      moveEntriesToInitialPosition()
    }

    // Inform the editor of the new top overflow and/or height if either has
    // changed
    if (overflowTopChanged || heightChanged) {
      window.dispatchEvent(
        new CustomEvent('review-panel:event', {
          detail: {
            type: 'sizes',
            payload: {
              overflowTop,
              height,
            },
          },
        })
      )
    }

    // Do the final move
    if (positionsChanged || overflowTopChanged) {
      moveToFinalPositions()
    }

    previousLayoutInfoRef.current = {
      positions,
      focusedEntryIndex,
      height,
      overflowTop,
    }
  }

  useEventListener('review-panel:layout', () => {
    layout()
  })

  // Layout on first render. This is necessary to ensure layout happens when
  // switching from overview to current file view
  useEffect(() => {
    dispatchReviewPanelLayout()
  }, [])

  return (
    <div
      ref={containerRef}
      className="rp-entry-list-react"
      style={{ height: `${contentHeight}px` }}
    >
      {children}
    </div>
  )
}

export default PositionedEntries
