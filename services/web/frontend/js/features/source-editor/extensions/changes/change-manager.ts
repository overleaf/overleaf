import { trackChangesAnnotation } from '../realtime'
import { clearChangeMarkers, buildChangeMarkers } from '../track-changes'
import {
  setVerticalOverflow,
  editorVerticalTopPadding,
  updateChangesTopPadding,
  updateSetsVerticalOverflow,
} from '../vertical-overflow'
import {
  EditorSelection,
  EditorState,
  StateEffect,
  TransactionSpec,
} from '@codemirror/state'
import { EditorView, ViewUpdate } from '@codemirror/view'
import { fullHeightCoordsAtPos } from '../../utils/layer'
import { debounce } from 'lodash'
import { Change, EditOperation } from '../../../../../../types/change'
import { ThreadId } from '../../../../../../types/review-panel/review-panel'
import { isDeleteOperation, isInsertOperation } from '@/utils/operations'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { updateHasEffect } from '@/features/source-editor/utils/effects'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

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

const dispatchReviewPanelLayoutImmediately = ({
  force = false,
  animate = true,
} = {}) => {
  window.dispatchEvent(
    new CustomEvent('review-panel:layout', { detail: { force, animate } })
  )
}

const scheduleDispatchReviewPanelLayout = debounce(
  dispatchReviewPanelLayoutImmediately,
  10
)

/**
 * @param force If true, forces the entries to be repositioned
 * @param animate
 * @param async If true, calls are briefly delayed and debounced
 */
export const dispatchReviewPanelLayout = ({
  force = false,
  animate = true,
  async = false,
} = {}) => {
  if (async) {
    scheduleDispatchReviewPanelLayout({ force, animate })
  } else {
    dispatchReviewPanelLayoutImmediately({ force, animate })
  }
}

export type ChangeManager = {
  initialize: () => void
  handleUpdate: (update: ViewUpdate) => void
  destroy: () => void
}

export type UpdateType =
  | 'edit'
  | 'selectionChange'
  | 'geometryChange'
  | 'viewportChange'
  | 'acceptChanges'
  | 'rejectChanges'
  | 'trackedChangesChange'
  | 'topPaddingChange'

export const createChangeManager = (
  view: EditorView,
  currentDoc: DocumentContainer
): ChangeManager | undefined => {
  if (isSplitTestEnabled('review-panel-redesign')) {
    return undefined
  }

  /**
   * Calculate the screen coordinates of each entry (change or comment),
   * for use in the review panel.
   *
   * Returns a boolean indicating whether the visibility of any entry has changed
   */
  const recalculateScreenPositions = ({
    entries,
    updateType,
  }: {
    entries?: Record<string, any>
    updateType: UpdateType
  }) => {
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

        if (!entry.screenPos) {
          visibilityChanged = true
        }

        entry.screenPos = { y, height, editorPaddingTop }
        entry.inViewport = true
      } else {
        entry.inViewport = false
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

    return { visibilityChanged, updateType }
  }

  /**
   * Add a comment (thread) to the ShareJS doc when it's created
   */
  const addComment = (offset: number, length: number, threadId: ThreadId) => {
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
    currentDoc.ranges!.removeCommentId(commentId)
  }

  /**
   * Remove tracked changes from the range tracker when they're accepted
   */
  const acceptChanges = (changeIds: string[]) => {
    currentDoc.ranges!.removeChangeIds(changeIds)
  }

  /**
   * Remove tracked changes from the range tracker when they're rejected,
   * and restore the original content
   */
  const rejectChanges = (changeIds: string[]) => {
    const changes = currentDoc.ranges!.getChanges(
      changeIds
    ) as Change<EditOperation>[]

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

      if (isInsertOperation(op)) {
        const from = op.p
        const content = op.i
        const to = from + content.length

        const text = view.state.doc.sliceString(from, to)

        if (text !== content) {
          throw new Error(`Op to be removed does not match editor text`)
        }

        return { from, to, insert: '' }
      } else if (isDeleteOperation(op)) {
        return {
          from: op.p,
          to: op.p,
          insert: op.d,
        }
      } else {
        throw new Error(`unknown change type: ${JSON.stringify(change)}`)
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
        const { visibilityChanged, updateType } =
          recalculateScreenPositions(payload)
        if (visibilityChanged) {
          dispatchEditorEvent('track-changes:visibility_changed')
        }
        // Ensure the layout is updated once the review panel entries have
        // updated in the React review panel. The use of a timeout is bad but
        // the timings are a bit of a mess and will be improved when the review
        // panel state is migrated away from Angular. Entries are not animated
        // into position when scrolling, or when the editor geometry changes
        // (e.g. because the window has been resized), or when the top padding
        // is adjusted
        const nonAnimatingUpdateTypes: UpdateType[] = [
          'viewportChange',
          'geometryChange',
          'topPaddingChange',
        ]
        const animate = !nonAnimatingUpdateTypes.includes(updateType)
        dispatchReviewPanelLayout({
          async: true,
          animate,
          force: false, // updateType === 'geometryChange',
        })
        break
      }

      case 'changes:accept': {
        acceptChanges(payload)
        view.dispatch(buildChangeMarkers())
        broadcastChange()
        // Dispatch a focus:changed event to force the Angular controller to
        // reassemble the list of entries without bulk actions
        scheduleDispatchFocusChanged(view.state, 'acceptChanges')
        break
      }

      case 'changes:reject': {
        view.dispatch(rejectChanges(payload))
        broadcastChange()
        // Dispatch a focus:changed event to force the Angular controller to
        // reassemble the list of entries without bulk actions
        setTimeout(() => {
          // Delay the execution to make sure it runs after `broadcastChange`
          scheduleDispatchFocusChanged(view.state, 'rejectChanges')
        }, 30)
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
        const editorFullContentHeight = view.contentDOM.clientHeight
        // the content height and top overflow of the review panel
        const { height, overflowTop } = payload
        // the difference between the review panel height and the editor content height
        const heightDiff = height + overflowTop - editorFullContentHeight
        // the height of the block added at the top of the editor to match the review panel
        const topPadding = editorVerticalTopPadding(view)
        const bottomPadding = view.documentPadding.bottom
        const contentHeight =
          editorFullContentHeight - (topPadding + bottomPadding)
        const newBottomPadding = height - contentHeight

        if (overflowTop !== topPadding || heightDiff !== 0) {
          view.dispatch(
            setVerticalOverflow({
              top: overflowTop,
              bottom: newBottomPadding,
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
   * @param updateType UpdateType
   */
  const dispatchFocusChangedImmediately = (
    state: EditorState,
    updateType: UpdateType
  ) => {
    // TODO: multiple selections?
    const { from, to, empty } = state.selection.main

    dispatchEditorEvent('focus:changed', {
      from,
      to,
      empty,
      updateType,
    })
  }

  const scheduleDispatchFocusChanged = debounce(
    dispatchFocusChangedImmediately,
    50
  )

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
      const changesTopPadding = updateChangesTopPadding(update)
      const {
        geometryChanged,
        viewportChanged,
        docChanged,
        focusChanged,
        selectionSet,
      } = update
      const setsVerticalOverflow = updateSetsVerticalOverflow(update)
      const ignoringGeometryChanges = Date.now() < ignoreGeometryChangesUntil

      if (geometryChanged && !docChanged && !ignoringGeometryChanges) {
        broadcastChange()
      }

      if (
        !setsVerticalOverflow &&
        (geometryChanged || viewportChanged) &&
        ignoringGeometryChanges
      ) {
        // Ignore a change to the editor geometry or viewport that occurs immediately after
        // an update to the vertical padding because otherwise it triggers
        // another update to the padding and so on ad infinitum. This is not an
        // ideal way to handle this but I couldn't see another way.
        return
      }

      if (changesTopPadding) {
        scheduleDispatchFocusChanged(update.state, 'topPaddingChange')
      } else if (docChanged) {
        scheduleDispatchFocusChanged(update.state, 'edit')
      } else if (focusChanged || selectionSet) {
        scheduleDispatchFocusChanged(update.state, 'selectionChange')
      } else if (viewportChanged && !geometryChanged) {
        // It's better to respond immediately to a viewport change, which
        // happens when scrolling, and have previously unpositioned entries
        // appear immediately rather than risk a delay due to debouncing
        dispatchFocusChangedImmediately(update.state, 'viewportChange')
      } else if (geometryChanged) {
        scheduleDispatchFocusChanged(update.state, 'geometryChange')
      }

      // Wait until after updating the review panel layout before starting the
      // interval during which to ignore geometry update
      if (setsVerticalOverflow) {
        ignoreGeometryChangesUntil = Date.now() + 50
      }
    },
    destroy() {
      removeListeners()
    },
  }
}

const reviewPanelToggledEffect = StateEffect.define()

export const updateHasReviewPanelToggledEffect = updateHasEffect(
  reviewPanelToggledEffect
)

export const reviewPanelToggled = (): TransactionSpec => ({
  effects: reviewPanelToggledEffect.of(null),
})
