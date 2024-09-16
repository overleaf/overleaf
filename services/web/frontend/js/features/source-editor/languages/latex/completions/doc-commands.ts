import { applySnippet, extendOverUnpairedClosingBrace } from './apply'
import { Completion, CompletionContext } from '@codemirror/autocomplete'
import { documentCommands } from '../document-commands'
import { Command } from '../../../utils/tree-operations/commands'
import { syntaxTree } from '@codemirror/language'

const commandNameFromLabel = (label: string): string | undefined =>
  label.match(/^\\\w+/)?.[0]

export function customCommandCompletions(
  context: CompletionContext,
  commandCompletions: Completion[]
) {
  const existingCommands = new Set(
    commandCompletions
      .map(item => commandNameFromLabel(item.label))
      .filter(Boolean)
  )

  const output: Completion[] = []

  const items = countCommandUsage(context)

  for (const item of items.values()) {
    if (
      !existingCommands.has(commandNameFromLabel(item.label)) &&
      !item.ignoreInAutoComplete
    ) {
      output.push({
        type: 'cmd',
        label: item.label,
        boost: Math.max(0, item.count - 10),
        apply: applySnippet(item.snippet),
        extend: extendOverUnpairedClosingBrace,
      })
    }
  }

  return commandCompletions.concat(output)
}

const countCommandUsage = (context: CompletionContext) => {
  const tree = syntaxTree(context.state)
  const currentNode = tree.resolveInner(context.pos, -1)

  const result = new Map<
    string,
    {
      label: string
      snippet: string
      count: number
      ignoreInAutoComplete?: boolean
    }
  >()

  const commandListProjection = context.state.field(documentCommands)

  if (!commandListProjection.items) {
    return result
  }

  for (const command of commandListProjection.items) {
    if (command.from === currentNode.from) {
      continue
    }
    const label = buildLabel(command)
    const snippet = buildSnippet(command)

    const item = result.get(label) || {
      label,
      snippet,
      count: 0,
      ignoreInAutoComplete: command.ignoreInAutocomplete,
    }
    item.count++
    result.set(label, item)
  }

  return result
}

const buildLabel = (command: Command): string => {
  return [
    `${command.title}`,
    '[]'.repeat(command.optionalArgCount ?? 0),
    '{}'.repeat(command.requiredArgCount ?? 0),
  ].join('')
}

const buildSnippet = (command: Command): string => {
  return [
    `${command.title}`,
    '[#{}]'.repeat(command.optionalArgCount ?? 0),
    '{#{}}'.repeat(command.requiredArgCount ?? 0),
  ].join('')
}
