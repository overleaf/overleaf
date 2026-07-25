import { useCallback } from 'react'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useCodeMirrorViewContext } from '@/features/source-editor/components/codemirror-context'
import { buildAddNewCommentRangeEffect } from '@/features/source-editor/extensions/review-tooltip'
import { selectHighlightedOrNearestToken } from '@/features/source-editor/utils/select-highlighted-or-nearest-token'
import { isCursorNearViewportEdge } from '@/features/source-editor/utils/is-cursor-near-edge'
import useEventListener from '@/shared/hooks/use-event-listener'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useReviewPanelViewActionsContext } from '@/features/review-panel/context/review-panel-view-context'
import useReviewPanelLayout from '@/features/review-panel/hooks/use-review-panel-layout'

// Headless owner of the "add comment" editor command. It is mounted whenever
// commenting is possible, independently of the floating menu's visibility, so
// the keyboard shortcut, toolbar command and floating menu button
// (which all dispatch `add-new-review-comment`) work even when the menu is hidden
const AddCommentCommand = () => {
  const view = useCodeMirrorViewContext()
  const permissions = usePermissionsContext()
  const { setView } = useReviewPanelViewActionsContext()
  const { openReviewPanel } = useReviewPanelLayout()

  const addComment = useCallback(() => {
    if (!permissions.comment) {
      return
    }

    let { main } = view.state.selection

    if (main.empty) {
      const tokenRange = selectHighlightedOrNearestToken(view.state)
      if (!tokenRange) {
        return
      }
      main = EditorSelection.range(tokenRange.from, tokenRange.to)
    }

    openReviewPanel()
    setView('cur_file')

    const effects = isCursorNearViewportEdge(view, main.anchor)
      ? [
          buildAddNewCommentRangeEffect(main),
          EditorView.scrollIntoView(main.anchor, { y: 'center' }),
        ]
      : [buildAddNewCommentRangeEffect(main)]

    // Dispatching a new selection clears the review tooltip state, which
    // dismisses the floating menu — no need to toggle menu state from here.
    view.dispatch({
      selection: { anchor: main.anchor, head: main.head },
      effects,
    })
  }, [view, permissions.comment, openReviewPanel, setView])

  useEventListener('add-new-review-comment', addComment)

  return null
}

export default AddCommentCommand
