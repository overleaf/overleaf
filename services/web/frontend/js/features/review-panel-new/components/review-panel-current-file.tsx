import {
  FC,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
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
import { positionItems } from '../utils/position-items'
import { canAggregate } from '../utils/can-aggregate'
import ReviewPanelEmptyState from './review-panel-empty-state'
import useEventListener from '@/shared/hooks/use-event-listener'
import { hasActiveRange } from '@/features/review-panel-new/utils/has-active-range'
import { addCommentStateField } from '@/features/source-editor/extensions/add-comment'

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

  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousFocusedItem = useRef(new Map<string, number>())

  const updatePositions = useCallback(() => {
    const docId = ranges?.docId

    if (containerRef.current && docId) {
      const positioningRes = positionItems(
        containerRef.current,
        previousFocusedItem.current.get(docId) || 0,
        docId
      )

      if (positioningRes) {
        previousFocusedItem.current.set(
          positioningRes.docId,
          positioningRes.activeItemIndex
        )
      }
    }
  }, [ranges?.docId])

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

  const addCommentRanges = state.field(addCommentStateField).ranges

  useEffect(() => {
    if (aggregatedRanges) {
      view.requestMeasure({
        key: 'review-panel-position',
        read(view) {
          const contentRect = view.contentDOM.getBoundingClientRect()
          const docLength = view.state.doc.length

          const screenPosition = (position: number): number | undefined => {
            const pos = Math.min(position, docLength) // TODO: needed?
            const coords = view.coordsAtPos(pos)

            return coords ? Math.round(coords.top - contentRect.top) : undefined
          }

          for (const change of aggregatedRanges.changes) {
            const position = screenPosition(change.op.p)
            if (position) {
              positionsRef.current.set(change.id, position)
            }
          }

          for (const comment of aggregatedRanges.comments) {
            const position = screenPosition(comment.op.p)
            if (position) {
              positionsRef.current.set(comment.id, position)
            }
          }

          const cursor = addCommentRanges.iter()

          while (cursor.value) {
            const { from } = cursor
            const position = screenPosition(from)

            if (position) {
              positionsRef.current.set(
                `new-comment-${cursor.value.spec.id}`,
                position
              )
            }

            cursor.next()
          }
        },
        write() {
          setPositions(new Map(positionsRef.current))
          window.setTimeout(() => {
            containerRef.current?.dispatchEvent(
              new Event('review-panel:position')
            )
          })
        },
      })
    }
  }, [view, aggregatedRanges, addCommentRanges])

  const showEmptyState = useMemo(
    () => hasActiveRange(ranges, threads) === false,
    [ranges, threads]
  )

  const addCommentEntries = useMemo(() => {
    const cursor = addCommentRanges.iter()

    const entries = []

    while (cursor.value) {
      const id = `new-comment-${cursor.value.spec.id}`
      if (!positions.has(id)) {
        cursor.next()
        continue
      }

      const { from, to } = cursor

      entries.push({
        id,
        from,
        to,
        value: cursor.value,
        top: positions.get(id),
      })

      cursor.next()
    }
    return entries
  }, [addCommentRanges, positions])

  if (!aggregatedRanges) {
    return null
  }

  return (
    <>
      {showEmptyState && <ReviewPanelEmptyState />}

      <div ref={handleContainer}>
        {addCommentEntries.map(entry => {
          const { id, from, to, value, top } = entry
          return (
            <ReviewPanelAddComment
              key={id}
              from={from}
              to={to}
              value={value}
              top={top}
            />
          )
        })}

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
    </>
  )
}

export default memo(ReviewPanelCurrentFile)
