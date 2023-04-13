import { Compartment, EditorState, TransactionSpec } from '@codemirror/state'

const phrasesConf = new Compartment()

export const phrases = (phrases: Record<string, string>) => {
  return phrasesConf.of(EditorState.phrases.of(phrases))
}

export const setPhrases = (value: Record<string, string>): TransactionSpec => {
  return {
    effects: phrasesConf.reconfigure(EditorState.phrases.of(value)),
  }
}
