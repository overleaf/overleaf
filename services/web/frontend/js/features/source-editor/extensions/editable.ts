import { Compartment, EditorState, TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const readOnlyConf = new Compartment()

/**
 * A custom extension which determines whether the content is editable, by setting the value of the EditorState.readOnly and EditorView.editable facets.
 * Commands and extensions read the EditorState.readOnly facet to decide whether they should be applied.
 * EditorView.editable determines whether the DOM can be focused, by changing the value of the contenteditable attribute.
 */
export const editable = () => {
  return [
    readOnlyConf.of([
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
    ]),
  ]
}

export const setEditable = (value = true): TransactionSpec => {
  return {
    effects: [
      readOnlyConf.reconfigure([
        EditorState.readOnly.of(!value),
        EditorView.editable.of(value),
      ]),
    ],
  }
}
