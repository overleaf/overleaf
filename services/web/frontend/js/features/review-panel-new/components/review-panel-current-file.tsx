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
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-editor'
import { useRangesContext } from '../context/ranges-context'
import { useThreadsContext } from '../context/threads-context'
import { isDeleteChange, isInsertChange } from '@/utils/operations'
import Icon from '@/shared/components/icon'
import { positionItems } from '../utils/position-items'
import { canAggregate } from '../utils/can-aggregate'
import ReviewPanelEmptyState from './review-panel-empty-state'
import useEventListener from '@/shared/hooks/use-event-listener'
import { hasActiveRange } from '@/features/review-panel-new/utils/has-active-range'

type AggregatedRanges = {
  changes: Change<EditOperation>[]
  comments: Change<CommentOperation>[]
  aggregates: Map<string, Change<DeleteOperation>>
}

const ReviewPanelCurrentFile: FC = () => {
  const view = useCodeMirrorViewContext()
  const ranges = useRangesContext()
  const threads = useThreadsContext()
  const state = useCodeMirrorStateContext()

  const [aggregatedRanges, setAggregatedRanges] = useState<AggregatedRanges>()

  const selectionCoords = useMemo(
    () =>
      state.selection.main.empty
        ? null
        : view.coordsAtPos(state.selection.main.head),
    [view, state]
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousFocusedItem = useRef(0)

  const updatePositions = useCallback(() => {
    if (containerRef.current) {
      const extents = positionItems(
        containerRef.current,
        previousFocusedItem.current
      )

      if (extents) {
        previousFocusedItem.current = extents.activeItemIndex
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      updatePositions()
    }, 50)

    return () => {
      window.clearTimeout(timer)
    }
  }, [state, updatePositions])

  const handleContainer = useCallback(
    (element: HTMLDivElement | null) => {
      containerRef.current = element
      if (containerRef.current) {
        containerRef.current.addEventListener(
          'review-panel:position',
          updatePositions
        )
      }
    },
    [updatePositions]
  )

  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener(
          'review-panel:position',
          updatePositions
        )
      }
    }
  }, [updatePositions])

  const buildAggregatedRanges = useCallback(() => {
    if (ranges) {
      const output: AggregatedRanges = {
        aggregates: new Map(),
        changes: [],
        comments: [],
      }

      let precedingChange: Change<EditOperation> | null = null

      for (const change of ranges.changes) {
        if (
          precedingChange &&
          isInsertChange(precedingChange) &&
          isDeleteChange(change) &&
          canAggregate(change, precedingChange)
        ) {
          output.aggregates.set(precedingChange.id, change)
        } else {
          output.changes.push(change)
        }

        precedingChange = change
      }

      if (threads) {
        for (const comment of ranges.comments) {
          if (!threads[comment.op.t]?.resolved) {
            output.comments.push(comment)
          }
        }
      }

      setAggregatedRanges(output)
    }
  }, [threads, ranges])

  useEffect(() => {
    buildAggregatedRanges()
  }, [buildAggregatedRanges])

  useEventListener('editor:viewport-changed', buildAggregatedRanges)

  const [positions, setPositions] = useState<Map<string, number>>(new Map())

  const positionsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (aggregatedRanges) {
      view.requestMeasure({
        key: 'review-panel-position',
        read(view) {
          const contentRect = view.contentDOM.getBoundingClientRect()
          const docLength = view.state.doc.length

          const screenPosition = (change: Change): number | undefined => {
            const pos = Math.min(change.op.p, docLength) // TODO: needed?
            const coords = view.coordsAtPos(pos)

            return coords ? Math.round(coords.top - contentRect.top) : undefined
          }

          for (const change of aggregatedRanges.changes) {
            const position = screenPosition(change)
            if (position) {
              positionsRef.current.set(change.id, position)
            }
          }

          for (const comment of aggregatedRanges.comments) {
            const position = screenPosition(comment)
            if (position) {
              positionsRef.current.set(comment.id, position)
            }
          }
        },
        write() {
          setPositions(positionsRef.current)
          window.setTimeout(() => {
            containerRef.current?.dispatchEvent(
              new Event('review-panel:position')
            )
          })
        },
      })
    }
  }, [view, aggregatedRanges])

  const showEmptyState = useMemo(
    () => hasActiveRange(ranges, threads) === false,
    [ranges, threads]
  )

  if (!aggregatedRanges) {
    return null
  }

  return (
    <div ref={handleContainer}>
      {selectionCoords && (
        <div
          className="review-panel-entry review-panel-entry-action"
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

      {aggregatedRanges.changes.map(
        change =>
          positions.has(change.id) && (
            <ReviewPanelChange
              key={change.id}
              change={change}
              top={positions.get(change.id)}
              aggregate={aggregatedRanges.aggregates.get(change.id)}
            />
          )
      )}

      {aggregatedRanges.comments.map(
        comment =>
          positions.has(comment.id) && (
            <ReviewPanelComment
              key={comment.id}
              comment={comment}
              top={positions.get(comment.id)}
            />
          )
      )}
    </div>
  )
}

export default memo(ReviewPanelCurrentFile)
