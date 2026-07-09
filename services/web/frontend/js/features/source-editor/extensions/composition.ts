import {
  ChangeSpec,
  EditorSelection,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { diffChars } from 'diff'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'

/*
 * Composition-aware syncing for the Overleaf <-> OT bridge.
 *
 * The OT layer cannot represent non-BMP characters (emoji etc.), so they are
 * replaced with the Unicode replacement character. The naive approach — scrub
 * them out of every transaction as it arrives — fires *during* an active IME
 * composition and rewrites the composed range, which breaks the browser IME
 * (candidate cycling stops, Backspace dies, a garbled glyph appears).
 *
 * Instead, while a composition is active we let the editor hold the real
 * composed text (including a previewed emoji) and pause forwarding changes to
 * the OT layer. The `compositionField` flag below is read by the state-level
 * extensions that forward to OT (`filter-characters`, `realtime`,
 * `history-ot`'s `updateSender`) so they become no-ops during composition.
 *
 * When the composition ends we:
 *   1. revert the composed text out of the editor (not forwarded to OT — which
 *      never saw it — and not added to the undo history), then
 *   2. re-apply the scrubbed text (one emoji -> a single replacement char) as a
 *      single *normal* edit. That edit flows through the usual local-edit path,
 *      so it syncs to the OT layer correctly for both OT modes and is attributed
 *      as a tracked change in review mode, and it forms a single, clean undo
 *      step back to the pre-composition state.
 *
 * If a remote edit arrives while composing, we can't safely merge, so we drop
 * the in-progress composition, resync to the snapshot, and warn the user.
 */

// Matches characters the OT layer cannot represent:
// - astral-plane code points (emoji etc.) — matched as a single code point
//   thanks to the `u` flag, so one emoji collapses to one replacement char
// - lone UTF-16 surrogates
// - NUL
export const BAD_CHARS_PATTERN = '[\\u{10000}-\\u{10FFFF}]|[\\0\\uD800-\\uDFFF]'
export const BAD_CHARS_REPLACEMENT_CHAR = '�'

const badCharsRegExp = () => new RegExp(BAD_CHARS_PATTERN, 'gu')

export const scrubBadChars = (text: string) =>
  text.replace(badCharsRegExp(), BAD_CHARS_REPLACEMENT_CHAR)

const setCompositionEffect = StateEffect.define<boolean>()

const compositionField = StateField.define<boolean>({
  create() {
    return false
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCompositionEffect)) {
        value = effect.value
      }
    }
    return value
  },
})

/**
 * Whether an IME composition is currently active. Readable from state-level
 * extensions (transaction filters/extenders) that have no access to the view.
 * Defaults to false if the field isn't installed.
 */
export const isComposing = (state: EditorState): boolean =>
  state.field(compositionField, false)

// Minimal change specs transforming the editor document `from` into `to`.
export const diffToChangeSpecs = (from: string, to: string): ChangeSpec[] => {
  const changes: ChangeSpec[] = []
  let pos = 0
  for (const part of diffChars(from, to)) {
    if (part.removed) {
      changes.push({ from: pos, to: pos + part.value.length })
      pos += part.value.length
    } else if (part.added) {
      changes.push({ from: pos, insert: part.value })
    } else {
      pos += part.value.length
    }
  }
  return changes
}

// Warn the user that their in-progress composition was discarded because a
// collaborator edited the same location while they were composing.
const showCompositionDiscardedToast = (text: string) => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: { key: 'composition:discarded', text },
    })
  )
}

// If CodeMirror hasn't finished flushing the committed composition by the time
// we run, retry on the next frame for up to this many frames before giving up.
const MAX_RECONCILE_FRAMES = 60

export const compositionSync = (currentDoc: DocumentContainer) => {
  const reconcile = (view: EditorView) => {
    if (!isComposing(view.state)) {
      // Already reconciled for this composition. Keeps this idempotent across
      // the compositionend handler and the composing-ended fallback below.
      return
    }

    const editor = currentDoc.cm6

    if (!currentDoc.doc) {
      // Nothing to reconcile against; just clear the flag.
      if (editor) {
        editor.remoteOpDuringComposition = false
      }
      view.dispatch({ effects: setCompositionEffect.of(false) })
      return
    }

    const snapshot = currentDoc.getSnapshot() ?? ''
    const editorText = view.state.doc.toString()
    const caret = view.state.selection.main.head

    // Revert the in-progress composition out of the editor. It was never added
    // to the undo history (see the transactionExtender below) and is marked
    // `remote` so it is not forwarded to the OT layer, which never saw it.
    const revertChanges = diffToChangeSpecs(editorText, snapshot)
    if (revertChanges.length) {
      view.dispatch({
        changes: revertChanges,
        annotations: [
          Transaction.remote.of(true),
          Transaction.addToHistory.of(false),
        ],
      })
    }

    if (editor?.remoteOpDuringComposition) {
      // A collaborator edited the document while this composition was active.
      // We buffered their change rather than disrupting the IME, but we can't
      // safely merge the in-progress composition against it. The revert above
      // already resynced the editor to the (remotely-updated) snapshot, so we
      // just drop the composition and warn the user.
      editor.remoteOpDuringComposition = false

      const discardedText = diffChars(snapshot, editorText)
        .filter(part => part.added)
        .map(part => part.value)
        .join('')
      if (discardedText) {
        showCompositionDiscardedToast(discardedText)
      }

      view.dispatch({ effects: setCompositionEffect.of(false) })
      return
    }

    // Clear the composition flag, then re-apply the scrubbed composed text as a
    // single normal edit. It flows through the usual local-edit path, so it
    // syncs to the OT layer (both modes, with track-changes attribution) and is
    // a single, clean undo step back to the pre-composition snapshot.
    view.dispatch({ effects: setCompositionEffect.of(false) })

    const target = scrubBadChars(editorText)
    const commitChanges = diffToChangeSpecs(snapshot, target)
    if (commitChanges.length) {
      // Restore the caret to its committed position (mapped through the scrub),
      // so committing a composition doesn't jump the cursor to the line start.
      const commitCaret = scrubBadChars(editorText.slice(0, caret)).length
      view.dispatch({
        changes: commitChanges,
        selection: EditorSelection.cursor(commitCaret),
      })
    }
  }

  const scheduleReconcile = (view: EditorView, framesLeft: number) => {
    requestAnimationFrame(() => {
      if (view.composing && framesLeft > 0) {
        // CodeMirror hasn't finished flushing the committed composition yet, or
        // a new composition started; wait another frame.
        scheduleReconcile(view, framesLeft - 1)
      } else {
        reconcile(view)
      }
    })
  }

  let wasComposing = false

  return [
    compositionField,
    // Keep the raw composition out of the undo history. The scrubbed result is
    // re-applied as a single undoable edit at compositionend (see reconcile),
    // so undo returns cleanly to the pre-composition state instead of leaving
    // an orphaned, un-undoable replacement char behind.
    EditorState.transactionExtender.of(tr => {
      if (
        tr.docChanged &&
        isComposing(tr.startState) &&
        !tr.annotation(Transaction.remote)
      ) {
        return { annotations: Transaction.addToHistory.of(false) }
      }
      return null
    }),
    EditorView.domEventHandlers({
      compositionstart(_event, view) {
        if (currentDoc.cm6) {
          currentDoc.cm6.remoteOpDuringComposition = false
        }
        view.dispatch({ effects: setCompositionEffect.of(true) })
      },
      compositionend(_event, view) {
        scheduleReconcile(view, MAX_RECONCILE_FRAMES)
      },
    }),
    // Fallback: if a composition ends without a compositionend event (e.g. blur
    // or the IME aborting), reconcile once CodeMirror reports it is no longer
    // composing, so the bridge can't get stuck paused. Idempotent with the
    // compositionend handler above (reconcile no-ops if already reconciled).
    EditorView.updateListener.of(update => {
      const composingNow = update.view.composing
      if (wasComposing && !composingNow && isComposing(update.state)) {
        scheduleReconcile(update.view, MAX_RECONCILE_FRAMES)
      }
      wasComposing = composingNow
    }),
  ]
}
