import { FC, useCallback, useState } from 'react'
import { AnyOperation } from '../../../../../types/change'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from '@/features/source-editor/components/codemirror-editor'
import { isSelectionWithinOp } from '../utils/is-selection-within-op'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import classNames from 'classnames'

export const ReviewPanelEntry: FC<{
  position: number
  op: AnyOperation
  top?: number
  className?: string
}> = ({ children, position, top, op, className }) => {
  const state = useCodeMirrorStateContext()
  const view = useCodeMirrorViewContext()
  const [focused, setFocused] = useState(false)

  const highlighted = isSelectionWithinOp(op, state.selection.main)

  const focusHandler = useCallback(() => {
    setTimeout(() => {
      // without setTimeout, error "EditorView.update are not allowed while an update is in progress" can occur
      // this can be avoided by using onClick rather than onFocus but it will then not pick up <Tab> or <Shift+Tab> events for focusing entries
      view.dispatch({
        selection: EditorSelection.cursor(position),
        effects: EditorView.scrollIntoView(position, { y: 'center' }),
      })
    }, 0)
    setFocused(true)
  }, [view, position])

  return (
    <div
      onFocus={focusHandler}
      onBlur={() => setFocused(false)}
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
