import { Compartment, EditorState, TransactionSpec } from '@codemirror/state'

const readOnlyConf = new Compartment()

export const editable = () => {
  return [readOnlyConf.of(EditorState.readOnly.of(true))]
}

export const setEditable = (value = true): TransactionSpec => {
  return {
    effects: [readOnlyConf.reconfigure(EditorState.readOnly.of(!value))],
  }
}
