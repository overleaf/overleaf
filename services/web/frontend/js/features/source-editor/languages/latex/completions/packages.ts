import {
  applySnippet,
  extendOverUnpairedClosingBrace,
  extendRequiredParameter,
} from './apply'
import { packageNames } from './data/package-names'
import { Completions } from './types'
import { CompletionContext } from '@codemirror/autocomplete'
import { metadataState } from '../../../extensions/language'

/**
 * Completions based on package names from bundled data and packages in the project
 */
export function buildPackageCompletions(
  completions: Completions,
  context: CompletionContext
) {
  const metadata = context.state.field(metadataState, false)

  if (!metadata) {
    return
  }

  const uniquePackageNames = new Set<string>(packageNames)

  // package names and commands from packages in the project
  for (const doc of Object.values(metadata.documents)) {
    for (const [packageName, commands] of Object.entries(doc.packages)) {
      uniquePackageNames.add(packageName)

      for (const item of commands) {
        completions.commands.push({
          type: item.meta,
          label: item.caption,
          apply: applySnippet(item.snippet),
          extend: extendOverUnpairedClosingBrace,
        })
      }
    }
  }

  const existingPackageNames = findExistingPackageNames(context)

  for (const item of uniquePackageNames) {
    if (!existingPackageNames.has(item)) {
      // package name parameter completion
      completions.packages.push({
        type: 'pkg',
        label: item,
        extend: extendRequiredParameter,
      })

      const label = `\\usepackage{${item}}`

      // full command with parameter completion
      completions.commands.push({
        type: 'pkg',
        label,
        extend: extendOverUnpairedClosingBrace,
      })
    }
  }

  // empty \\usepackage{…} snippet
  completions.commands.push({
    type: 'pkg',
    label: '\\usepackage{}',
    boost: 10,
    apply: applySnippet('\\usepackage{#{}}'),
    extend: extendOverUnpairedClosingBrace,
  })
}

const findExistingPackageNames = (context: CompletionContext) => {
  const { doc } = context.state

  const excludeLineNumber = doc.lineAt(context.pos).number

  const items = new Set<string>()

  let currentLineNumber = 1
  for (const line of doc.iterLines()) {
    if (currentLineNumber++ === excludeLineNumber) {
      continue
    }

    // TODO: exclude comments

    for (const match of line.matchAll(/\\usepackage(\[.+?])?{(?<name>\w+)}/g)) {
      const { name } = match.groups as { name: string }
      items.add(name)
    }
  }

  return items
}
