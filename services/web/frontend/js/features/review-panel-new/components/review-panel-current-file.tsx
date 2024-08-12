import {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ReviewPanelAddComment } from './review-panel-add-comment'
import { ReviewPanelChange } from './review-panel-change'
import { ReviewPanelComment } from './review-panel-comment'
import {
  Change,
  CommentOperation,
  DeleteOperation,
  EditOperation,
} from '../../../../../types/change'
import {
  editorOverflowPadding,
  editorVerticalTopPadding,
} from '@/features/source-editor/extensions/vertical-overflow'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-editor'
import { useRangesContext } from '../context/ranges-context'
import { useThreadsContext } from '../context/threads-context'
import { isDeleteChange, isInsertChange } from '@/utils/operations'
import Icon from '@/shared/components/icon'
import { positionItems } from '../utils/position-items'
import { canAggregate } from '../utils/can-aggregate'
import { isInViewport } from '../utils/is-in-viewport'
import ReviewPanelEmptyState from './review-panel-empty-state'

type Positions = Map<string, number>
type Aggregates = Map<string, Change<DeleteOperation>>

type RangesWithPositions = {
  changes: Change<EditOperation>[]
  comments: Change<CommentOperation>[]
  positions: Positions
  aggregates: Aggregates
}

const ReviewPanelCurrentFile: FC = () => {
  const view = useCodeMirrorViewContext()
  const ranges = useRangesContext()
  const threads = useThreadsContext()
  const state = useCodeMirrorStateContext()

  const [rangesWithPositions, setRangesWithPositions] =
    useState<RangesWithPositions>()

  const contentRect = view.contentDOM.getBoundingClientRect()

  const editorPaddingTop = editorVerticalTopPadding(view)
  const topDiff = contentRect.top - editorPaddingTop
  const docLength = state.doc.length

  const screenPosition = useCallback(
    (change: Change): number | undefined => {
      const pos = Math.min(change.op.p, docLength)
      const coords = view.coordsAtPos(pos)

      return coords ? Math.round(coords.top - topDiff) : undefined
    },
    [docLength, topDiff, view]
  )

  const selectionCoords = useMemo(
    () =>
      state.selection.main.empty
        ? null
        : view.coordsAtPos(state.selection.main.head),
    [view, state]
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const ignoreNextUpdateRef = useRef(false)
  const previousFocusedItem = useRef(0)

  const updatePositions = useCallback(() => {
    if (ignoreNextUpdateRef.current) {
      ignoreNextUpdateRef.current = false
      return
    }

    if (containerRef.current) {
      const extents = positionItems(
        containerRef.current,
        view.scrollDOM as HTMLDivElement,
        previousFocusedItem.current
      )

      if (extents) {
        previousFocusedItem.current = extents.focusedItemIndex

        window.setTimeout(() => {
          const top = extents.min < 0 ? -extents.min : 0
          const bottom =
            extents.max > contentRect.bottom
              ? extents.max - contentRect.bottom
              : 0

          const currentPadding = editorOverflowPadding(view)

          if (
            currentPadding?.top !== top ||
            currentPadding?.bottom !== bottom
          ) {
            // ignoreNextUpdateRef.current = true
            // view.dispatch(setVerticalOverflow({ top, bottom }))
          }
        })
      }
    }
  }, [contentRect.bottom, view])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      updatePositions()
    }, 100)

    return () => {
      window.clearTimeout(timer)
    }
  }, [state, updatePositions, view.viewport.from, view.viewport.to])

  useEffect(() => {
    const element = containerRef.current
    if (element) {
      element.addEventListener('review-panel:position', updatePositions)
      // view.scrollDOM.addEventListener('scroll', positionListener)
      return () => {
        element.removeEventListener('review-panel:position', updatePositions)
        // view.scrollDOM.removeEventListener('scroll', positionListener)
      }
    }
  }, [view, updatePositions])

  useEffect(() => {
    if (ranges) {
      view.requestMeasure({
        key: 'review-panel-position',
        read(view): RangesWithPositions {
          const isVisible = isInViewport(view)

          const output: RangesWithPositions = {
            positions: new Map(),
            aggregates: new Map(),
            changes: [],
            comments: [],
          }

          let precedingChange: Change<EditOperation> | null = null

          for (const change of ranges.changes) {
            if (isVisible(change)) {
              if (
                precedingChange &&
                isInsertChange(precedingChange) &&
                isDeleteChange(change) &&
                canAggregate(change, precedingChange)
              ) {
                output.aggregates.set(precedingChange.id, change)
              } else {
                output.changes.push(change)

                const position = screenPosition(change)
                if (position) {
                  output.positions.set(change.id, position)
                }
              }
            }

            precedingChange = change
          }

          if (threads) {
            for (const comment of ranges.comments) {
              if (isVisible(comment)) {
                output.comments.push(comment)
                if (!threads[comment.op.t]?.resolved) {
                  const position = screenPosition(comment)
                  if (position) {
                    output.positions.set(comment.id, position)
                  }
                }
              }
            }
          }

          return output
        },
        write(positionedRanges) {
          setRangesWithPositions(positionedRanges)
          window.setTimeout(() => {
            containerRef.current?.dispatchEvent(
              new Event('review-panel:position')
            )
          })
        },
      })
    }
  }, [view, threads, ranges, screenPosition, containerRef])

  if (!rangesWithPositions) {
    return null
  }

  const showEmptyState =
    threads &&
    rangesWithPositions.changes.length === 0 &&
    rangesWithPositions.comments.length === 0

  return (
    <div ref={containerRef}>
      {selectionCoords && (
        <div
          className="review-panel-entry"
          style={{ position: 'absolute' }}
          data-top={selectionCoords.top + view.scrollDOM.scrollTop - 70}
          data-pos={state.selection.main.head}
        >
          <div className="review-panel-entry-indicator">
            <Icon type="pencil" fw />
          </div>
          <div className="review-panel-entry-content">
            <ReviewPanelAddComment />
          </div>
        </div>
      )}

      {showEmptyState && <ReviewPanelEmptyState />}

      {rangesWithPositions.changes.map(change => (
        <ReviewPanelChange
          key={change.id}
          change={change}
          top={rangesWithPositions.positions.get(change.id)}
          aggregate={rangesWithPositions.aggregates.get(change.id)}
        />
      ))}

      {rangesWithPositions.comments.map(comment => (
        <ReviewPanelComment
          key={comment.id}
          comment={comment}
          top={rangesWithPositions.positions.get(comment.id)}
        />
      ))}
    </div>
  )
}

export default memo(ReviewPanelCurrentFile)
