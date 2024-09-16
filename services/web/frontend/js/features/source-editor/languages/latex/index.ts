import { latexIndentService } from './latex-indent-service'
import { shortcuts } from './shortcuts'
import { linting } from './linting'
import { LanguageSupport } from '@codemirror/language'
import { CompletionSource } from '@codemirror/autocomplete'
import { openAutocomplete } from './open-autocomplete'
import { metadata } from './metadata'
import {
  argumentCompletionSources,
  explicitCommandCompletionSource,
  inCommandCompletionSource,
  beginEnvironmentCompletionSource,
} from './complete'
import { documentCommands } from './document-commands'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { documentOutline } from './document-outline'
import { LaTeXLanguage } from './latex-language'
import { documentEnvironments } from './document-environments'
import {
  figureModal,
  figureModalPasteHandler,
} from '../../extensions/figure-modal'

const completionSources: CompletionSource[] = [
  ...argumentCompletionSources,
  inCommandCompletionSource,
  explicitCommandCompletionSource,
  beginEnvironmentCompletionSource,
  ...importOverleafModules('sourceEditorCompletionSources').map(
    (item: any) => item.import.default
  ),
]

export const latex = () => {
  return new LanguageSupport(LaTeXLanguage, [
    shortcuts(),
    documentOutline,
    documentCommands,
    documentEnvironments,
    latexIndentService(),
    linting(),
    metadata(),
    openAutocomplete(),
    ...completionSources.map(completionSource =>
      LaTeXLanguage.data.of({
        autocomplete: completionSource,
      })
    ),
    figureModal(),
    figureModalPasteHandler(),
  ])
}
