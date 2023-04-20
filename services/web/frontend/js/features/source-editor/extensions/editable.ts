import { Compartment, EditorState, TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const readOnlyConf = new Compartment()

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
