import { CompletionContext, CompletionSection } from '@codemirror/autocomplete'
import importOverleafModules from '../../../../../../macros/import-overleaf-module.macro'

type SectionGenerator = (
  context: CompletionContext,
  type: string
) => CompletionSection | string | undefined
const sectionTitleGenerators: Array<SectionGenerator> = importOverleafModules(
  'sectionTitleGenerators'
).map(
  (item: { import: { getSection: SectionGenerator } }) => item.import.getSection
)

export function maybeGetSectionForOption(
  context: CompletionContext,
  type: string
) {
  for (const generator of sectionTitleGenerators) {
    const section = generator(context, type)
    if (section !== undefined) {
      return section
    }
  }
  return undefined
}
