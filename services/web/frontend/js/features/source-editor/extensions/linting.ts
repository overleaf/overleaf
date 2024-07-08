import { Compartment, EditorState } from '@codemirror/state'
import { setSyntaxValidationEffect } from './language'
import { linter } from '@codemirror/lint'

export const createLinter: typeof linter = (lintSource, config) => {
  const linterConfig = new Compartment()

  return [
    linterConfig.of([]),

    // enable/disable the linter to match the syntaxValidation setting
    EditorState.transactionExtender.of(tr => {
      for (const effect of tr.effects) {
        if (effect.is(setSyntaxValidationEffect)) {
          return {
            effects: linterConfig.reconfigure(
              effect.value ? linter(lintSource, config) : []
            ),
          }
        }
      }

      return null
    }),
  ]
}
