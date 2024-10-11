import { FC, useCallback, useEffect, useState } from 'react'
import { AnyOperation } from '../../../../../types/change'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-context'
import { isSelectionWithinOp } from '../utils/is-selection-within-op'
import classNames from 'classnames'
import {
  clearHighlightRanges,
  highlightRanges,
} from '@/features/source-editor/extensions/ranges'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { useLayoutContext } from '@/shared/context/layout-context'

export const ReviewPanelEntry: FC<{
  position: number
  op: AnyOperation
  docId: string
  top?: number
  className?: string
  selectLineOnFocus?: boolean
  hoverRanges?: boolean
  disabled?: boolean
}> = ({
  children,
  position,
  top,
  op,
  className,
  selectLineOnFocus = true,
  docId,
  hoverRanges = true,
  disabled,
}) => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const { openDocId } = useEditorManagerContext()
  const [focused, setFocused] = useState(false)
  const { setReviewPanelOpen } = useLayoutContext()

  const highlighted = isSelectionWithinOp(op, state.selection.main)

  const openReviewPanel = useCallback(() => {
    setReviewPanelOpen(true)
  }, [setReviewPanelOpen])

  const focusHandler = useCallback(
    event => {
      if (
        event.target instanceof HTMLButtonElement ||
        event.target instanceof HTMLLinkElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLAnchorElement
      ) {
        // Don't focus if the click was on a button/link/textarea/anchor as we
        // don't want to affect the behaviour of the button/link/textarea/anchor
        return
      }

      if (selectLineOnFocus) {
        openDocId(docId, { gotoOffset: position, keepCurrentView: true })
      }
      setFocused(true)
    },
    [selectLineOnFocus, docId, openDocId, position]
  )

  // Clear op highlight on dismount
  useEffect(() => {
    return () => {
      if (hoverRanges) {
        setTimeout(() => {
          view.dispatch(clearHighlightRanges(op))
        })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onMouseDown={openReviewPanel} // Using onMouseDown rather than onClick to guarantee that it fires before onFocus
      onFocus={focusHandler}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => {
        if (hoverRanges) {
          view.dispatch(highlightRanges(op))
        }
      }}
      onMouseLeave={() => {
        if (hoverRanges) {
          view.dispatch(clearHighlightRanges(op))
        }
      }}
      role="button"
      tabIndex={position + 1}
      className={classNames(
        'review-panel-entry',
        {
          'review-panel-entry-focused': focused,
          'review-panel-entry-highlighted': highlighted,
          'review-panel-entry-disabled': disabled,
        },
        className
      )}
      data-top={top}
      data-pos={position}
      style={{
        position: top === undefined ? 'relative' : 'absolute',
        visibility: top === undefined ? 'visible' : 'hidden',
        transition: 'top .3s, left .1s, right .1s',
      }}
    >
      {children}
    </div>
  )
}
