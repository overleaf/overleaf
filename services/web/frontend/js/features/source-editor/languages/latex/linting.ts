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

    // TODO: enable this once https://github.com/overleaf/internal/issues/10055 is fixed
    // ViewPlugin.define(view => {
    //   return {
    //     update(update) {
    //       // force the linter to run if the selection has changed
    //       if (update.selectionSet) {
    //         // note: no timeout needed as this is already asynchronous
    //         forceLinting(view, true) // TODO: true to force run even if doc hasn't changed
    //       }
    //     },
    //   }
    // }),
  ]
}
