import { extendRequiredParameter } from './apply'
import { Completions } from './types'
import { metadataState } from '../../../extensions/language'
import { CompletionContext } from '@codemirror/autocomplete'

/**
 * Labels parsed from docs in the project, for cross-referencing
 */
export function buildLabelCompletions(
  completions: Completions,
  context: CompletionContext
) {
  const metadata = context.state.field(metadataState, false)

  if (!metadata) {
    return
  }

  const uniqueLabels = new Set(
    Object.values(metadata.documents)
      .map(doc => doc.labels)
      .flat(1)
  )

  for (const label of uniqueLabels) {
    completions.labels.push({
      type: 'label',
      label,
      extend: extendRequiredParameter,
    })
  }
}
