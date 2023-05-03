import { Completions } from './types'
import { extendRequiredParameter } from './apply'
import { bibliographyStyles } from './data/bibliography-styles'

const values = Object.values(bibliographyStyles).flat()

export function buildBibliographyStyleCompletions(completions: Completions) {
  // TODO: find bibliography package from context and use only relevant styles

  for (const item of values) {
    completions.bibliographyStyles.push({
      type: 'bib',
      label: item,
      extend: extendRequiredParameter,
    })
  }
}
