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
} from '@/features/source-editor/components/codemirror-context'
import { useRangesContext } from '../context/ranges-context'
import { useThreadsContext } from '../context/threads-context'
import { isDeleteChange, isInsertChange } from '@/utils/operations'
import { positionItems } from '../utils/position-items'
import { canAggregate } from '../utils/can-aggregate'
import ReviewPanelEmptyState from './review-panel-empty-state'
import useEventListener from '@/shared/hooks/use-event-listener'
import { hasActiveRange } from '@/features/review-panel-new/utils/has-active-range'
import { reviewTooltipStateField } from '@/features/source-editor/extensions/review-tooltip'
import ReviewPanelMoreCommentsButton from './review-panel-more-comments-button'
import useMoreCommments from '../hooks/use-more-comments'
import { Decoration } from '@codemirror/view'
import { debounce } from 'lodash'

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
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null)

  const hoverTimeout = useRef<number>(0)
  const handleEntryEnter = useCallback((id: string) => {
    clearTimeout(hoverTimeout.current)
    setHoveredEntry(id)
  }, [])

  const handleEntryLeave = useCallback((id: string) => {
    clearTimeout(hoverTimeout.current)
    hoverTimeout.current = window.setTimeout(() => {
      setHoveredEntry(null)
    }, 100)
  }, [])

  const [aggregatedRanges, setAggregatedRanges] = useState<AggregatedRanges>()

  const containerRef = useRef<HTMLDivElement | null>(null)
  const previousFocusedItem = useRef(new Map<string, number>())

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
          if (threads[comment.op.t] && !threads[comment.op.t]?.resolved) {
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

  const addCommentRanges = state.field(
    reviewTooltipStateField,
    false
  )?.addCommentRanges

  const setUpdatedPositions = useMemo(
    () =>
      debounce(() => {
        setPositions(new Map(positionsRef.current))
        window.setTimeout(() => {
          containerRef.current?.dispatchEvent(
            new Event('review-panel:position')
          )
        })
      }, 50),
    []
  )

  const positionsMeasureRequest = useCallback(() => {
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

          if (!addCommentRanges) {
            return
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
          setUpdatedPositions()
        },
      })
    }
  }, [view, aggregatedRanges, addCommentRanges, setUpdatedPositions])

  useEffect(positionsMeasureRequest, [positionsMeasureRequest])
  useEventListener('editor:geometry-change', positionsMeasureRequest)

  const showEmptyState = useMemo(
    () => hasActiveRange(ranges, threads) === false,
    [ranges, threads]
  )

  const addCommentEntries = useMemo(() => {
    if (!addCommentRanges) {
      return []
    }

    const cursor = addCommentRanges.iter()

    const entries = []

    while (cursor.value) {
      const id = `new-comment-${cursor.value.spec.id}`
      if (!positions.has(id)) {
        cursor.next()
        continue
      }

      const { from, to, value } = cursor

      entries.push({
        id,
        from,
        to,
        threadId: value.spec.id,
        top: positions.get(id),
      })

      cursor.next()
    }
    return entries
  }, [addCommentRanges, positions])

  const {
    onEntriesPositioned,
    onMoreCommentsAboveClick,
    onMoreCommentsBelowClick,
  } = useMoreCommments(
    aggregatedRanges?.changes ?? [],
    aggregatedRanges?.comments ?? [],
    addCommentRanges ?? Decoration.none
  )

  const updatePositions = useCallback(() => {
    const docId = ranges?.docId

    if (containerRef.current && docId) {
      const positioningRes = positionItems(
        containerRef.current,
        previousFocusedItem.current.get(docId),
        docId
      )

      onEntriesPositioned()

      if (positioningRes) {
        previousFocusedItem.current.set(
          positioningRes.docId,
          positioningRes.activeItemIndex
        )
      }
    }
  }, [ranges?.docId, onEntriesPositioned])

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

  if (!aggregatedRanges) {
    return null
  }

  return (
    <>
      {showEmptyState && <ReviewPanelEmptyState />}
      {onMoreCommentsAboveClick && (
        <ReviewPanelMoreCommentsButton
          onClick={onMoreCommentsAboveClick}
          direction="upward"
        />
      )}

      <div ref={handleContainer}>
        {addCommentEntries.map(entry => {
          const { id, from, to, threadId, top } = entry
          return (
            <ReviewPanelAddComment
              docId={ranges!.docId}
              key={id}
              from={from}
              to={to}
              threadId={threadId}
              top={top}
            />
          )
        })}

        {aggregatedRanges.changes.map(
          change =>
            positions.has(change.id) && (
              <ReviewPanelChange
                docId={ranges!.docId}
                key={change.id}
                change={change}
                top={positions.get(change.id)}
                aggregate={aggregatedRanges.aggregates.get(change.id)}
                hovered={hoveredEntry === change.id}
                onEnter={handleEntryEnter}
                onLeave={handleEntryLeave}
              />
            )
        )}

        {aggregatedRanges.comments.map(
          comment =>
            positions.has(comment.id) && (
              <ReviewPanelComment
                docId={ranges!.docId}
                key={comment.id}
                comment={comment}
                top={positions.get(comment.id)}
                hovered={hoveredEntry === comment.id}
                onEnter={handleEntryEnter}
                onLeave={handleEntryLeave}
              />
            )
        )}
      </div>
      {onMoreCommentsBelowClick && (
        <ReviewPanelMoreCommentsButton
          onClick={onMoreCommentsBelowClick}
          direction="downward"
        />
      )}
    </>
  )
}

export default memo(ReviewPanelCurrentFile)
