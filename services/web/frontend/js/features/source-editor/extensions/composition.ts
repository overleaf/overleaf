import {
  ChangeSpec,
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { TextOperation } from 'overleaf-editor-core'
import { diffChars } from 'diff'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { ShareLatexOTShareDoc } from '../../../../../types/share-doc'

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
 * When the composition ends we scrub the committed text (code-point aware, so
 * one emoji collapses to a single replacement char) and reconcile the OT layer
 * once, by diffing the OT snapshot against the scrubbed editor text.
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

// Build a TextOperation transforming `from` into `to`, for history-OT.
const buildTextOperation = (from: string, to: string): TextOperation => {
  const op = new TextOperation()
  for (const part of diffChars(from, to)) {
    if (part.removed) {
      op.remove(part.value.length)
    } else if (part.added) {
      op.insert(part.value)
    } else {
      op.retain(part.value.length)
    }
  }
  return op
}

// Apply the diff between `from` and `to` to a sharejs-text-ot shareDoc, using
// the same insert/del calls the normal local-change path uses.
const applySharejsDiff = (
  shareDoc: ShareLatexOTShareDoc,
  from: string,
  to: string
) => {
  let pos = 0
  for (const part of diffChars(from, to)) {
    if (part.removed) {
      shareDoc.del(pos, part.value.length)
    } else if (part.added) {
      shareDoc.insert(pos, part.value)
      pos += part.value.length
    } else {
      pos += part.value.length
    }
  }
}

// Minimal change specs to replace each bad-char run in the editor with a single
// replacement char.
const computeScrubChanges = (state: EditorState): ChangeSpec[] => {
  const text = state.doc.toString()
  const changes: ChangeSpec[] = []
  for (const match of text.matchAll(badCharsRegExp())) {
    const from = match.index!
    changes.push({
      from,
      to: from + match[0].length,
      insert: BAD_CHARS_REPLACEMENT_CHAR,
    })
  }
  return changes
}

// If CodeMirror hasn't finished flushing the committed composition by the time
// we run, retry on the next frame for up to this many frames before giving up.
const MAX_RECONCILE_FRAMES = 60

export const compositionSync = (currentDoc: DocumentContainer) => {
  const reconcile = (view: EditorView) => {
    if (!currentDoc.doc) {
      // Nothing to reconcile against; just clear the flag.
      view.dispatch({ effects: setCompositionEffect.of(false) })
      return
    }

    const otText = currentDoc.getSnapshot() ?? ''
    const editorText = view.state.doc.toString()
    const target = scrubBadChars(editorText)

    // 1. Reconcile the OT layer to the scrubbed text in a single operation. The
    //    composition flag is still set, so the normal forwarding paths stay
    //    paused and won't double-submit.
    if (otText !== target) {
      if (currentDoc.isHistoryOT()) {
        currentDoc.historyOTShareDoc.submitOp([
          buildTextOperation(otText, target),
        ])
      } else {
        applySharejsDiff(
          currentDoc.shareDoc as ShareLatexOTShareDoc,
          otText,
          target
        )
      }
    }

    // 2. Replace any bad chars in the editor with the replacement char. Still
    //    flagged as composing, so this is not forwarded to the OT layer.
    const scrubChanges = computeScrubChanges(view.state)
    if (scrubChanges.length) {
      view.dispatch({
        changes: scrubChanges,
        annotations: Transaction.addToHistory.of(false),
      })
    }

    // 3. Clear the composition flag, resuming normal syncing.
    view.dispatch({ effects: setCompositionEffect.of(false) })
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

  return [
    compositionField,
    EditorView.domEventHandlers({
      compositionstart(_event, view) {
        view.dispatch({ effects: setCompositionEffect.of(true) })
      },
      compositionend(_event, view) {
        scheduleReconcile(view, MAX_RECONCILE_FRAMES)
      },
    }),
  ]
}
