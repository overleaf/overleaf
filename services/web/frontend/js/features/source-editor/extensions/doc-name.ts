import { StateEffect, StateField } from '@codemirror/state'

export const docName = (docName: string) =>
  StateField.define<string>({
    create() {
      return docName
    },
    update(value, tr) {
      for (const effect of tr.effects) {
        if (effect.is(setDocNameEffect)) {
          value = effect.value
        }
      }
      return value
    },
  })

export const setDocNameEffect = StateEffect.define<string>()

export const setDocName = (docName: string) => {
  return {
    effects: setDocNameEffect.of(docName),
  }
}
