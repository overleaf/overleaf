import {
  Compartment,
  StateEffect,
  StateField,
  TransactionSpec,
} from '@codemirror/state'
import { languages } from '../languages'
import { ViewPlugin } from '@codemirror/view'
import { indentUnit, LanguageDescription } from '@codemirror/language'
import { updateHasEffect } from '../utils/effects'
import { Folder } from '../../../../../types/folder'
import { Command } from '@/features/ide-react/context/metadata-context'
import { AdvancedReferenceSearchResult } from '@/features/ide-react/references/types'

export const languageLoadedEffect = StateEffect.define()
export const hasLanguageLoadedEffect = updateHasEffect(languageLoadedEffect)

const languageConf = new Compartment()

type Options = {
  syntaxValidation: boolean
}

export type Metadata = {
  labels: Set<string>
  packageNames: Set<string>
  commands: Command[]
  referenceKeys: Set<string>
  searchLocalReferences: (
    query: string
  ) => Promise<AdvancedReferenceSearchResult>
  fileTreeData: Folder
}

/**
 * A state field that stores the metadata parsed from a project on the server.
 */
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

const languageCompartment = new Compartment()

/**
 * The parser and support extensions for each supported language,
 * which are loaded dynamically as needed.
 */
export const language = (
  docName: string,
  metadata: Metadata,
  { syntaxValidation }: Options
) => languageCompartment.of(buildExtension(docName, metadata, syntaxValidation))

const buildExtension = (
  docName: string,
  metadata: Metadata,
  syntaxValidation: boolean
) => {
  const languageDescription = LanguageDescription.matchFilename(
    languages,
    docName
  )

  if (!languageDescription) {
    return []
  }

  return [
    /**
     * Default to four-space indentation and set the configuration in advance,
     * to prevent a shift in line indentation markers when the LaTeX language loads.
     */
    languageConf.of(indentUnit.of('    ')),
    metadataState,
    /**
     * A view plugin which loads the appropriate language for the current file extension,
     * then dispatches an effect so other extensions can update accordingly.
     */
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

export const setLanguage = (
  docName: string,
  metadata: Metadata,
  syntaxValidation: boolean
) => {
  return {
    effects: languageCompartment.reconfigure(
      buildExtension(docName, metadata, syntaxValidation)
    ),
  }
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
