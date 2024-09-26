import { FC, useCallback, useState } from 'react'
import { AnyOperation } from '../../../../../types/change'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-editor'
import { isSelectionWithinOp } from '../utils/is-selection-within-op'
import classNames from 'classnames'
import { highlightRanges } from '@/features/source-editor/extensions/ranges'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'

export const ReviewPanelEntry: FC<{
  position: number
  op: AnyOperation
  docId: string
  top?: number
  className?: string
  selectLineOnFocus?: boolean
  hoverRanges?: boolean
}> = ({
  children,
  position,
  top,
  op,
  className,
  selectLineOnFocus = true,
  docId,
  hoverRanges = true,
}) => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const { openDocId } = useEditorManagerContext()
  const [focused, setFocused] = useState(false)

  const highlighted = isSelectionWithinOp(op, state.selection.main)

  const focusHandler = useCallback(() => {
    if (selectLineOnFocus) {
      openDocId(docId, { gotoOffset: position, keepCurrentView: true })
    }
    setFocused(true)
  }, [selectLineOnFocus, docId, openDocId, position])

  return (
    <div
      onFocus={focusHandler}
      onBlur={() => setFocused(false)}
      onMouseEnter={() => {
        if (hoverRanges) {
          view.dispatch(highlightRanges(op))
        }
      }}
      onMouseLeave={() => {
        if (hoverRanges) {
          view.dispatch(highlightRanges())
        }
      }}
      role="button"
      tabIndex={position + 1}
      className={classNames(
        'review-panel-entry',
        {
          'review-panel-entry-focused': focused,
          'review-panel-entry-highlighted': highlighted,
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
