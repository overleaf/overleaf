import {
  Compartment,
  StateEffect,
  StateField,
  TransactionSpec,
} from '@codemirror/state'
import { languages } from '../languages'
import { ViewPlugin } from '@codemirror/view'
import { indentUnit, LanguageDescription } from '@codemirror/language'
import { Metadata } from '../../../../../types/metadata'
import { CurrentDoc } from '../../../../../types/current-doc'
import { updateHasEffect } from '../utils/effects'

export const languageLoadedEffect = StateEffect.define()
export const hasLanguageLoadedEffect = updateHasEffect(languageLoadedEffect)

const languageConf = new Compartment()

type Options = {
  syntaxValidation: boolean
}

export const metadataState = StateField.define<Metadata | undefined>({
  create: () => undefined,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setMetadataEffect)) {
        return effect.value
      }
    }
    return value
  },
})

export const language = (
  currentDoc: CurrentDoc,
  metadata: Metadata,
  { syntaxValidation }: Options
) => {
  const languageDescription = LanguageDescription.matchFilename(
    languages,
    currentDoc.docName
  )

  if (!languageDescription) {
    return []
  }

  return [
    // Default to four-space indentation, which prevents a shift in line
    // indentation markers when LaTeX loads
    languageConf.of(indentUnit.of('    ')),
    metadataState,
    ViewPlugin.define(view => {
      // load the language asynchronously
      languageDescription.load().then(support => {
        view.dispatch({
          effects: [
            languageConf.reconfigure(support),
            languageLoadedEffect.of(null),
          ],
        })
        // Wait until the previous effects have been processed
        view.dispatch({
          effects: [
            setMetadataEffect.of(metadata),
            setSyntaxValidationEffect.of(syntaxValidation),
          ],
        })
      })

      return {}
    }),
    metadataState,
  ]
}

export const setMetadataEffect = StateEffect.define<Metadata>()

export const setMetadata = (values: Metadata): TransactionSpec => {
  return {
    effects: setMetadataEffect.of(values),
  }
}

export const setSyntaxValidationEffect = StateEffect.define<boolean>()

export const setSyntaxValidation = (value: boolean): TransactionSpec => {
  return {
    effects: setSyntaxValidationEffect.of(value),
  }
}
