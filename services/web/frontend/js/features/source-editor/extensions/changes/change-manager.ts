import { trackChangesAnnotation } from '../realtime'
import { clearChangeMarkers, buildChangeMarkers } from '../track-changes'
import {
  setVerticalOverflow,
  updateSetsVerticalOverflow,
  editorVerticalTopPadding,
} from '../vertical-overflow'
import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { CurrentDoc } from '../../../../../../types/current-doc'
import { fullHeightCoordsAtPos } from '../../utils/layer'
import { debounce } from 'lodash'

// With less than this number of entries, don't bother culling to avoid
// little UI jumps when scrolling.
const CULL_AFTER = Infinity // Note: was 100 but couldn't scroll to see items outside the viewport

export const dispatchEditorEvent = (type: string, payload?: unknown) => {
  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent('editor:event', {
        detail: { type, payload },
      })
    )
  }, 0)
}

export type ChangeManager = {
  initialize: () => void
  handleUpdate: (update: ViewUpdate) => void
  destroy: () => void
}

export const createChangeManager = (
  view: EditorView,
  currentDoc: CurrentDoc
): ChangeManager => {
  /**
   * Calculate the screen coordinates of each entry (change or comment),
   * for use in the review panel.
   *
   * Returns a boolean indicating whether the visibility of any entry has changed
   */
  const recalculateScreenPositions = (entries?: Record<string, any>) => {
    const contentRect = view.contentDOM.getBoundingClientRect()

    const { doc } = view.state

    const items = Object.values(entries || {})

    const allVisible = items.length <= CULL_AFTER
    let visibilityChanged = false

    const docLength = doc.length

    const editorPaddingTop = editorVerticalTopPadding(view)

    for (const entry of items) {
      // TODO: clamp to max row and column, account for folding?
      const coords = fullHeightCoordsAtPos(
        view,
        Math.min(entry.offset, docLength) // avoid exception for comments at end of document when deleting text
      )

      if (coords) {
        const y = Math.round(coords.top - contentRect.top - editorPaddingTop)
        const height = Math.round(coords.bottom - coords.top)

        entry.screenPos = { y, height, editorPaddingTop }
      }

      if (allVisible) {
        if (!entry.visible) {
          visibilityChanged = true
        }
        entry.visible = true
      }
    }

    if (!allVisible) {
      const { from, to } = view.viewport

      for (const entry of items) {
        const previouslyVisible = entry.visible

        entry.visible = entry.offset >= from && entry.offset <= to

        if (previouslyVisible !== entry.visible) {
          visibilityChanged = true
        }
      }
    }

    return visibilityChanged
  }

  /**
   * Add a comment (thread) to the ShareJS doc when it's created
   */
  const addComment = (offset: number, length: number, threadId: string) => {
    currentDoc.submitOp({
      c: view.state.doc.sliceString(offset, offset + length),
      p: offset,
      t: threadId,
    })
  }

  /**
   * Remove a comment (thread) from the range tracker when it's deleted
   */
  const removeComment = (commentId: string) => {
    currentDoc.ranges.removeCommentId(commentId)
  }

  /**
   * Remove tracked changes from the range tracker when they're accepted
   */
  const acceptChanges = (changeIds: string[]) => {
    currentDoc.ranges.removeChangeIds(changeIds)
  }

  /**
   * Remove tracked changes from the range tracker when they're rejected,
   * and restore the original content
   */
  const rejectChanges = (changeIds: string[]) => {
    const changes: any[] = currentDoc.ranges.getChanges(changeIds)

    if (changes.length === 0) {
      return {}
    }

    // When doing bulk rejections, adjacent changes might interact with each other.
    // Consider an insertion with an adjacent deletion (which is a common use-case, replacing words):
    //
    //     "foo bar baz" -> "foo quux baz"
    //
    // The change above will be modeled with two ops, with the insertion going first:
    //
    //     foo quux baz
    //         |--| -> insertion of "quux", op 1, at position 4
    //             | -> deletion of "bar", op 2, pushed forward by "quux" to position 8
    //
    // When rejecting these changes at once, if the insertion is rejected first, we get unexpected
    // results. What happens is:
    //
    //     1) Rejecting the insertion deletes the added word "quux", i.e., it removes 4 chars
    //        starting from position 4;
    //
    //           "foo quux baz" -> "foo  baz"
    //                |--| -> 4 characters to be removed
    //
    //     2) Rejecting the deletion adds the deleted word "bar" at position 8 (i.e. it will act as if
    //        the word "quuux" was still present).
    //
    //            "foo  baz" -> "foo  bazbar"
    //                     | -> deletion of "bar" is reverted by reinserting "bar" at position 8
    //
    // While the intended result would be "foo bar baz", what we get is:
    //
    //      "foo  bazbar" (note "bar" readded at position 8)
    //
    // The issue happens because of step 1. To revert the insertion of "quux", 4 characters are deleted
    // from position 4. This includes the position where the deletion exists; when that position is
    // cleared, the RangesTracker considers that the deletion is gone and stops tracking/updating it.
    // As we still hold a reference to it, the code tries to revert it by readding the deleted text, but
    // does so at the outdated position (position 8, which was valid when "quux" was present).
    //
    // To avoid this kind of problem, we need to make sure that reverting operations doesn't affect
    // subsequent operations that come after. Reverse sorting the operations based on position will
    // achieve it; in the case above, it makes sure that the the deletion is reverted first:
    //
    //     1) Rejecting the deletion adds the deleted word "bar" at position 8
    //
    //            "foo quux baz" -> "foo quuxbar baz"
    //                                       | -> deletion of "bar" is reverted by
    //                                            reinserting "bar" at position 8
    //
    //     2) Rejecting the insertion deletes the added word "quux", i.e., it removes 4 chars
    //        starting from position 4 and achieves the expected result:
    //
    //           "foo quuxbar baz" -> "foo bar baz"
    //                |--| -> 4 characters to be removed

    changes.sort((a, b) => b.op.p - a.op.p)

    const changesToDispatch = changes.map(change => {
      const { op } = change

      const opType = 'i' in op ? 'i' : 'c' in op ? 'c' : 'd'

      switch (opType) {
        case 'd': {
          return {
            from: op.p,
            to: op.p,
            insert: op.d,
          }
        }

        case 'i': {
          const from = op.p
          const content = op.i
          const to = from + content.length

          const text = view.state.doc.sliceString(from, to)

          if (text !== content) {
            throw new Error(
              `Op to be removed (${JSON.stringify(
                change.op
              )}) does not match editor text '${text}'`
            )
          }

          return { from, to, insert: '' }
        }

        default: {
          throw new Error(`unknown change: ${JSON.stringify(change)}`)
        }
      }
    })

    return {
      changes: changesToDispatch,
      annotations: [trackChangesAnnotation.of('reject')],
    }
  }

  /**
   * If the current selection is empty, select the whole line.
   *
   * Used when adding a comment with no selected range, e.g. with a keyboard shortcut.
   */
  const selectCurrentLine = () => {
    if (view.state.selection.main.empty) {
      const line = view.state.doc.lineAt(view.state.selection.main.from)

      view.dispatch({
        selection: {
          anchor: line.from,
          head: line.to === view.state.doc.length ? line.to : line.to + 1,
        },
      })
    }
  }

  /**
   * Collapse the current selection to a single point (after inserting a comment)
   */
  const collapseSelection = () => {
    view.dispatch({
      selection: EditorSelection.cursor(view.state.selection.main.head),
    })
  }

  /**
   * Listen for events dispatched from the (Angular) review panel.
   *
   * These are combined into a single listener, avoiding the need to add and remove event listeners individually.
   */
  const reviewPanelEventListener = (event: Event) => {
    const { type, payload } = (
      event as CustomEvent<{ type: string; payload: any }>
    ).detail

    switch (type) {
      // receive review panel scroll events
      case 'scroll': {
        view.scrollDOM.scrollBy(0, payload)
        break
      }

      case 'overview-closed': {
        window.setTimeout(() => {
          dispatchScrollEvent()
        }, 0)
        break
      }

      case 'recalculate-screen-positions': {
        const changed = recalculateScreenPositions(payload)
        if (changed) {
          dispatchEditorEvent('track-changes:visibility_changed')
        }
        break
      }

      case 'changes:accept': {
        acceptChanges(payload)
        view.dispatch(buildChangeMarkers())
        broadcastChange()
        break
      }

      case 'changes:reject': {
        view.dispatch(rejectChanges(payload))
        broadcastChange()
        break
      }

      case 'comment:select_line': {
        selectCurrentLine()
        broadcastChange()
        break
      }

      case 'comment:add': {
        addComment(payload.offset, payload.length, payload.threadId)
        collapseSelection()
        broadcastChange()
        break
      }

      case 'comment:remove': {
        removeComment(payload)
        view.dispatch(buildChangeMarkers())
        broadcastChange()
        break
      }

      case 'comment:resolve_threads':
      case 'comment:unresolve_thread': {
        view.dispatch(buildChangeMarkers())
        broadcastChange()
        break
      }

      case 'loaded_threads': {
        view.dispatch(buildChangeMarkers())
        broadcastChange()
        break
      }

      case 'sizes': {
        const { overflowTop, height } = payload
        const padding = view.documentPadding
        const contentHeight =
          view.contentDOM.clientHeight - padding.top - padding.bottom
        const paddingNeeded = height - contentHeight

        if (
          overflowTop !== editorVerticalTopPadding(view) ||
          paddingNeeded !== padding.bottom
        ) {
          view.dispatch(
            setVerticalOverflow({
              top: overflowTop,
              bottom: paddingNeeded,
            })
          )
        }

        break
      }
    }
  }

  const broadcastChange = debounce(() => {
    dispatchEditorEvent('track-changes:changed')
  }, 50)

  /**
   * When the editor content, focus, size, viewport or selection changes,
   * tell the review panel to update.
   *
   * @param state object
   */
  const dispatchFocusChangedEvent = debounce((state: EditorState) => {
    // TODO: multiple selections?
    const { from, to, empty } = state.selection.main

    dispatchEditorEvent('focus:changed', { from, to, empty })
  }, 50)

  /**
   * When the editor is scrolled, tell the review panel so it can scroll in sync.
   */
  const dispatchScrollEvent = () => {
    window.dispatchEvent(
      new CustomEvent('editor:scroll', {
        detail: {
          height: view.scrollDOM.scrollHeight,
          scrollTop: view.scrollDOM.scrollTop,
          paddingTop: editorVerticalTopPadding(view),
        },
      })
    )
  }

  /**
   * Add event listeners to the ShareJS doc so that change markers are rebuilt when the tracked changes are updated.
   *
   * Also add event listeners to the editor scroll DOM and window.
   */
  const addListeners = () => {
    // NOTE: the namespace "cm6" is needed so the listeners can be removed individually
    currentDoc.on('ranges:dirty.cm6', () => {
      // TODO: use currentDoc.ranges.getDirtyState and only update those which have changed?
      window.setTimeout(() => {
        view.dispatch(buildChangeMarkers())
        broadcastChange()
      }, 0)
    })

    // called on joinDoc
    currentDoc.on('ranges:clear.cm6', () => {
      window.setTimeout(() => {
        view.dispatch(clearChangeMarkers())
        broadcastChange()
      }, 0)
    })

    // called on joinDoc
    currentDoc.on('ranges:redraw.cm6', () => {
      window.setTimeout(() => {
        view.dispatch(buildChangeMarkers())
        broadcastChange()
      }, 0)
    })

    // sync review panel scroll with editor scroll
    view.scrollDOM.addEventListener('scroll', dispatchScrollEvent)

    // listen for events from the review panel controller
    window.addEventListener('review-panel:event', reviewPanelEventListener)
  }

  /**
   * Remove event listeners
   */
  const removeListeners = () => {
    currentDoc.off('ranges:clear.cm6')
    currentDoc.off('ranges:dirty.cm6')
    currentDoc.off('ranges:redraw.cm6')

    view.scrollDOM.removeEventListener('scroll', dispatchScrollEvent)

    window.removeEventListener('review-panel:event', reviewPanelEventListener)
  }

  let ignoreGeometryChangesUntil = 0

  return {
    initialize() {
      addListeners()
      broadcastChange()
    },
    handleUpdate(update: ViewUpdate) {
      if (update.geometryChanged && !update.docChanged) {
        broadcastChange()
      }

      if (updateSetsVerticalOverflow(update)) {
        ignoreGeometryChangesUntil = Date.now() + 50 // ignore changes for 50ms
      } else if (
        (update.geometryChanged || update.viewportChanged) &&
        Date.now() < ignoreGeometryChangesUntil
      ) {
        // Ignore a change to the editor geometry or viewport that occurs immediately after
        // an update to the vertical padding because otherwise it triggers
        // another update to the padding and so on ad infinitum. This is not an
        // ideal way to handle this but I couldn't see another way.
        return
      }

      if (
        update.docChanged ||
        update.focusChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.geometryChanged
      ) {
        dispatchFocusChangedEvent(update.state)
      }
    },
    destroy() {
      removeListeners()
    },
  }
}
