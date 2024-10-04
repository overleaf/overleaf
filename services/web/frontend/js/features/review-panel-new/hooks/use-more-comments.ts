import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-editor'
import {
  Change,
  CommentOperation,
  EditOperation,
} from '../../../../../types/change'
import { DecorationSet, EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import _ from 'lodash'
import { useLayoutContext } from '@/shared/context/layout-context'

const useMoreCommments = (
  changes: Change<EditOperation>[],
  comments: Change<CommentOperation>[],
  newComments: DecorationSet
): {
  onEntriesPositioned: () => void
  onMoreCommentsAboveClick: null | (() => void)
  onMoreCommentsBelowClick: null | (() => void)
} => {
  const view = useCodeMirrorViewContext()
  const { reviewPanelOpen } = useLayoutContext()

  const [positionAbove, setPositionAbove] = useState<number | null>(null)
  const [positionBelow, setPositionBelow] = useState<number | null>(null)

  const updateEntryPositions = useMemo(
    () =>
      _.debounce(
        () =>
          view.requestMeasure({
            key: 'review-panel-more-comments',
            read(view) {
              const container = view.scrollDOM

              if (!container || !reviewPanelOpen) {
                return { positionAbove: null, positionBelow: null }
              }

              const containerTop = container.scrollTop
              const containerBottom = containerTop + container.clientHeight

              // First check for any entries in view by looking for the actual rendered entries
              for (const entryElt of container.querySelectorAll<HTMLElement>(
                '.review-panel-entry'
              )) {
                const entryTop = entryElt?.offsetTop ?? 0
                const entryBottom = entryTop + (entryElt?.offsetHeight ?? 0)

                if (entryBottom > containerTop && entryTop < containerBottom) {
                  // Some part of the entry is in view
                  return { positionAbove: null, positionBelow: null }
                }
              }

              // Find the max and min positions in the visible part of the viewport
              const visibleFrom = view.lineBlockAtHeight(containerTop).from
              const visibleTo = view.lineBlockAtHeight(containerBottom).to

              // Then go through the positions to find the first entry above and below the visible viewport.
              // We can't use the rendered entries for this because only the entries that are in the viewport (or
              // have been in the viewport during the current page view session) are actually rendered.
              let firstEntryAbove: number | null = null
              let firstEntryBelow: number | null = null

              const updateFirstEntryAboveBelowPositions = (
                position: number
              ) => {
                if (visibleFrom === null || position < visibleFrom) {
                  firstEntryAbove = Math.max(firstEntryAbove ?? 0, position)
                }

                if (visibleTo === null || position > visibleTo) {
                  firstEntryBelow = Math.min(
                    firstEntryBelow ?? Number.MAX_VALUE,
                    position
                  )
                }
              }

              for (const entry of [...changes, ...comments]) {
                updateFirstEntryAboveBelowPositions(entry.op.p)
              }

              const cursor = newComments.iter()
              while (cursor.value) {
                updateFirstEntryAboveBelowPositions(cursor.from)
                cursor.next()
              }

              return {
                positionAbove: firstEntryAbove,
                positionBelow: firstEntryBelow,
              }
            },
            write({ positionAbove, positionBelow }) {
              setPositionAbove(positionAbove)
              setPositionBelow(positionBelow)
            },
          }),
        200
      ),
    [changes, comments, newComments, view, reviewPanelOpen]
  )

  useEffect(() => {
    const scrollerElt = document.getElementsByClassName('cm-scroller')[0]
    if (scrollerElt) {
      scrollerElt.addEventListener('scroll', updateEntryPositions)
      return () => {
        scrollerElt.removeEventListener('scroll', updateEntryPositions)
      }
    }
  }, [updateEntryPositions])

  const onMoreCommentsClick = useCallback(
    (position: number) => {
      view.dispatch({
        effects: EditorView.scrollIntoView(position, {
          y: 'center',
        }),
        selection: EditorSelection.cursor(position),
      })
    },
    [view]
  )

  const onMoreCommentsAboveClick = useCallback(() => {
    if (positionAbove !== null) {
      onMoreCommentsClick(positionAbove)
    }
  }, [positionAbove, onMoreCommentsClick])

  const onMoreCommentsBelowClick = useCallback(() => {
    if (positionBelow !== null) {
      onMoreCommentsClick(positionBelow)
    }
  }, [positionBelow, onMoreCommentsClick])

  return {
    onEntriesPositioned: updateEntryPositions,
    onMoreCommentsAboveClick:
      positionAbove !== null ? onMoreCommentsAboveClick : null,
    onMoreCommentsBelowClick:
      positionBelow !== null ? onMoreCommentsBelowClick : null,
  }
}

export default useMoreCommments
