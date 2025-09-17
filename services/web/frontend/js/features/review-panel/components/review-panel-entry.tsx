import { FC, useCallback, useEffect, useRef, useState } from 'react'
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
import { EditorSelection } from '@codemirror/state'
import { OFFSET_FOR_ENTRIES_ABOVE } from '../utils/position-items'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'
import { EntryIndicator } from './review-panel-entry-indicator'
import { EditorView } from '@codemirror/view'

export const ReviewPanelEntry: FC<
  React.PropsWithChildren<{
    position: number
    op: AnyOperation
    docId: string
    top?: number
    className?: string
    selectLineOnFocus?: boolean
    hoverRanges?: boolean
    disabled?: boolean
    handleEnter?: () => void
    handleLeave?: () => void
    entryIndicator?: 'comment' | 'edit'
  }>
> = ({
  children,
  position,
  top,
  op,
  className,
  selectLineOnFocus = true,
  docId,
  hoverRanges = true,
  disabled,
  handleEnter,
  handleLeave,
  entryIndicator,
}) => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const { openDocWithId, getCurrentDocumentId } = useEditorManagerContext()
  const [selected, setSelected] = useState(false)
  const [focused, setFocused] = useState(false)
  const [textareaFocused, setTextareaFocused] = useState(false)
  const { openReviewPanel } = useReviewPanelLayout()
  const highlighted = isSelectionWithinOp(op, state.selection.main)
  const entryRef = useRef<HTMLDivElement>(null)
  const mousePressedRef = useRef(false)

  const selectEntry = useCallback(
    (event: React.FocusEvent | React.MouseEvent) => {
      setFocused(true)

      if (event.target instanceof HTMLTextAreaElement) {
        const entryBottom =
          (entryRef.current?.offsetTop || 0) +
          (entryRef.current?.offsetHeight || 0)

        if (entryBottom > OFFSET_FOR_ENTRIES_ABOVE) {
          // if the entry textarea is visible, no need to select the entry
          // so that it doesn't scroll out of view as user types
          setTextareaFocused(true)
          return
        }
      }

      if (mousePressedRef.current) {
        return
      }

      setSelected(true)

      if (!selectLineOnFocus) {
        return
      }

      if (getCurrentDocumentId() !== docId) {
        openDocWithId(docId, { gotoOffset: position, keepCurrentView: true })
      } else {
        setTimeout(() => {
          const selection = EditorSelection.cursor(position)

          // if the position is outside the viewport, so could be estimated,
          // use EditorView.scrollIntoView (accurate, not smooth)
          if (position < view.viewport.from || view.viewport.to < position) {
            view.dispatch({
              selection,
              effects: EditorView.scrollIntoView(selection, { y: 'center' }),
            })
            return
          }

          // if the position is inside the viewport, so accurate,
          // use scrollDOM.scrollTo (smooth)

          view.dispatch({ selection })

          // scroll to line (centered)
          const blockInfo = view.lineBlockAt(position)
          const coordsAtPos = view.coordsAtPos(position)
          const coordsAtLineStart = view.coordsAtPos(blockInfo.from)
          let wrappedLineOffset = 0
          if (coordsAtPos !== null && coordsAtLineStart !== null) {
            wrappedLineOffset = coordsAtPos.top - coordsAtLineStart.top
          }

          const editorHeight = view.scrollDOM.getBoundingClientRect().height
          view.scrollDOM.scrollTo({
            top:
              blockInfo.top -
              editorHeight / 2 +
              view.defaultLineHeight +
              wrappedLineOffset,
            behavior: 'smooth',
          })
        })
      }
    },
    [
      getCurrentDocumentId,
      docId,
      selectLineOnFocus,
      view,
      position,
      openDocWithId,
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
      ref={entryRef}
      onMouseDown={() => {
        mousePressedRef.current = true
      }}
      onMouseUp={event => {
        mousePressedRef.current = false
        const isTextSelected = Boolean(window.getSelection()?.toString())
        if (!isTextSelected && !selected) {
          selectEntry(event)
        }
      }}
      onFocus={selectEntry}
      onBlur={() => {
        mousePressedRef.current = false
        setSelected(false)
        setFocused(false)
        setTextareaFocused(false)
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
          // 'textarea-focused' only changes entry styling (border, shadow etc)
          // it doesnt change selected entry because that moves the cursor
          // and repositions entries which can cause textarea to be scrolled out of view
          'review-panel-entry-textarea-focused': textareaFocused,
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
        <EntryIndicator
          type={entryIndicator}
          handleMouseEnter={handleEnter}
          handleMouseLeave={handleLeave}
          handleMouseDown={openReviewPanel}
        />
      )}
      {children}
    </div>
  )
}
