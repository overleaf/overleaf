import { applySnippet, extendOverUnpairedClosingBrace } from './apply'
import { Completion, CompletionContext } from '@codemirror/autocomplete'
import { documentCommands } from '../document-commands'
import { Command } from '../../../utils/tree-operations/commands'

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
    if (!existingCommands.has(commandNameFromLabel(item.label))) {
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
  const { doc } = context.state

  const excludeLineNumber = doc.lineAt(context.pos).number

  const result = new Map<
    string,
    { label: string; snippet: string; count: number }
  >()

  const commandListProjection = context.state.field(documentCommands)
  if (!commandListProjection.items) {
    return result
  }

  for (const command of commandListProjection.items) {
    if (command.line === excludeLineNumber) {
      continue
    }
    const label = buildLabel(command)
    const snippet = buildSnippet(command)

    const item = result.get(label) || { label, snippet, count: 0 }
    item.count++
    result.set(label, item)
  }

  return result
}

const buildLabel = (command: Command): string => {
  return [
    `${command.title}`,
    '[]'.repeat(command.optionalArgCount),
    '{}'.repeat(command.requiredArgCount),
  ].join('')
}

const buildSnippet = (command: Command): string => {
  return [
    `${command.title}`,
    '[#{}]'.repeat(command.optionalArgCount),
    '{#{}}'.repeat(command.requiredArgCount),
  ].join('')
}
