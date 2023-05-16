import { Compartment, EditorState } from '@codemirror/state'
import { setSyntaxValidationEffect } from '../../extensions/language'
import { linter } from '@codemirror/lint'
import { latexLinter } from './linter/latex-linter'
import { lintSourceConfig } from '../../extensions/annotations'

export const linting = () => {
  const latexLintSourceConf = new Compartment()

  return [
    latexLintSourceConf.of([]),

    // enable/disable the linter to match the syntaxValidation setting
    EditorState.transactionExtender.of(tr => {
      for (const effect of tr.effects) {
        if (effect.is(setSyntaxValidationEffect)) {
          return {
            effects: latexLintSourceConf.reconfigure(
              effect.value ? linter(latexLinter, lintSourceConfig) : []
            ),
          }
        }
      }

      return null
    }),
  ]
}
