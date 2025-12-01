import { Compartment, EditorState, TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const readOnlyConf = new Compartment()

// Make the editor focusable even when contenteditable="false" (read-only mode)
// This allows keyboard shortcuts like Cmd+F to work in read-only mode
const focusableReadOnly = EditorView.contentAttributes.of({ tabindex: '0' })

// Hide the blinking cursor in read-only mode
const hideCursor = EditorView.theme({
  '&.cm-editor .cm-cursorLayer': {
    display: 'none',
  },
})

const readOnlyAttributes = [
  EditorState.readOnly.of(true),
  EditorView.editable.of(false),
  focusableReadOnly,
  hideCursor,
]

const editableAttributes = [
  EditorState.readOnly.of(false),
  EditorView.editable.of(true),
]

/**
 * A custom extension which determines whether the content is editable, by setting the value of the EditorState.readOnly and EditorView.editable facets.
 * Commands and extensions read the EditorState.readOnly facet to decide whether they should be applied.
 * EditorView.editable determines whether the DOM can be focused, by changing the value of the contenteditable attribute.
 * We add tabindex="0" in read-only mode to ensure the editor remains focusable for keyboard shortcuts.
 */
export const editable = () => {
  return [readOnlyConf.of(readOnlyAttributes)]
}

export const setEditable = (value = true): TransactionSpec => {
  return {
    effects: [
      readOnlyConf.reconfigure(value ? editableAttributes : readOnlyAttributes),
    ],
  }
}
