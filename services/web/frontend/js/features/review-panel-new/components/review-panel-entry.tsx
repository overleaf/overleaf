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
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import MaterialIcon from '@/shared/components/material-icon'

export const ReviewPanelEntry: FC<{
  position: number
  op: AnyOperation
  docId: string
  top?: number
  className?: string
  selectLineOnFocus?: boolean
  hoverRanges?: boolean
  disabled?: boolean
  onEnterEntryIndicator?: () => void
  onLeaveEntryIndicator?: () => void
  entryIndicator?: 'comment' | 'edit'
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
  onEnterEntryIndicator,
  onLeaveEntryIndicator,
  entryIndicator,
}) => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const { openDocId, getCurrentDocId } = useEditorManagerContext()
  const [selected, setSelected] = useState(false)
  const [focused, setFocused] = useState(false)
  const { setReviewPanelOpen, reviewPanelOpen } = useLayoutContext()
  const highlighted = isSelectionWithinOp(op, state.selection.main)

  const openReviewPanel = useCallback(() => {
    setReviewPanelOpen(true)
  }, [setReviewPanelOpen])

  const focusHandler = useCallback(
    event => {
      setFocused(true)

      if (
        event.target instanceof HTMLButtonElement ||
        event.target instanceof HTMLLinkElement ||
        event.target instanceof HTMLAnchorElement ||
        (event.target instanceof HTMLTextAreaElement && !reviewPanelOpen)
      ) {
        // Ignore focus events on certain elements so as to not affect
        // their behavior
        return
      }

      setSelected(true)

      if (!selectLineOnFocus) {
        return
      }

      if (getCurrentDocId() !== docId) {
        const focusIsOnTextarea = event.target instanceof HTMLTextAreaElement
        if (focusIsOnTextarea === false) {
          openDocId(docId, { gotoOffset: position, keepCurrentView: true })
        }
      } else {
        setTimeout(() =>
          view.dispatch({
            selection: EditorSelection.cursor(position),
            effects: EditorView.scrollIntoView(position, { y: 'center' }),
          })
        )
      }
    },
    [
      getCurrentDocId,
      docId,
      selectLineOnFocus,
      view,
      position,
      openDocId,
      reviewPanelOpen,
    ]
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
      onFocus={focusHandler}
      onBlur={() => {
        setSelected(false)
        setFocused(false)
      }}
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
          // 'selected' is used to manually select an entry
          // useful if the range is within range and you want to show the one outside the viewport
          // it is not enough to just check isSelectionWithinOp for that
          'review-panel-entry-selected': selected,
          // 'focused' is set even when an entry was clicked but not selected (like clicking on a menu option)
          // used to set z-index above other entries (since entries are not ordered the same way visually and in the DOM)
          'review-panel-entry-focused': focused,
          // 'highlighted' is set if the selection is within op but that doesn't necessarily mean it should be selected
          // multiple entries can be highlighted at the same time
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
      {entryIndicator && (
        <div
          className="review-panel-entry-indicator"
          onMouseEnter={onEnterEntryIndicator}
          onMouseLeave={onLeaveEntryIndicator}
          onMouseDown={openReviewPanel} // Using onMouseDown rather than onClick to guarantee that it fires before onFocus
          role="button"
          tabIndex={0}
        >
          <MaterialIcon
            type={entryIndicator}
            className="review-panel-entry-icon"
          />
        </div>
      )}
      {children}
    </div>
  )
}
