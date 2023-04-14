import { latexIndentService } from './latex-indent-service'
import { shortcuts } from './shortcuts'
import { linting } from './linting'
import { LanguageSupport, indentUnit } from '@codemirror/language'
import { CompletionSource } from '@codemirror/autocomplete'
import { openAutocomplete } from './open-autocomplete'
import { metadata } from './metadata'
import {
  argumentCompletionSources,
  explicitCommandCompletionSource,
  inCommandCompletionSource,
} from './complete'
import { documentCommands } from './document-commands'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { documentOutline } from './document-outline'
import { LaTeXLanguage } from './latex-language'
import { documentEnvironmentNames } from './document-environment-names'

const completionSources = importOverleafModules('sourceEditorCompletionSources')
  .map((item: any) => item.import.default)
  .concat(
    argumentCompletionSources,
    inCommandCompletionSource,
    explicitCommandCompletionSource
  ) as CompletionSource[]

export const latex = () => {
  return new LanguageSupport(LaTeXLanguage, [
    indentUnit.of('    '), // 4 spaces
    shortcuts(),
    documentOutline.extension,
    documentCommands.extension,
    documentEnvironmentNames.extension,
    latexIndentService(),
    linting(),
    metadata(),
    openAutocomplete(),
    ...completionSources.map(completionSource =>
      LaTeXLanguage.data.of({
        autocomplete: completionSource,
      })
    ),
  ])
}
