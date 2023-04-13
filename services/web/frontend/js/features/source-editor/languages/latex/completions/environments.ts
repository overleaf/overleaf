import { environments, snippet } from './data/environments'
import { customSnippetCompletion, createCommandApplier } from './apply'
import { Completion, CompletionContext } from '@codemirror/autocomplete'
import { Completions } from './types'

/**
 * Environments from bundled data
 */
export function buildEnvironmentCompletions(completions: Completions) {
  for (const [item, snippet] of environments) {
    completions.commands.push(
      customSnippetCompletion(
        snippet,
        {
          type: 'env',
          label: `\\begin{${item}} …`,
        },
        // clear snippet for some environments after inserting
        item === 'itemize' || item === 'enumerate'
      )
    )
  }
}

/**
 * A `begin` environment completion with a snippet, for the current context
 */
export function customBeginCompletion(name: string) {
  if (environments.has(name)) {
    return null
  }

  return customSnippetCompletion(snippet(name), {
    label: `\\begin{${name}} …`,
  })
}

/**
 * `end` completions for open environments in the current doc, up to the current context
 * @return {*[]}
 */
export function customEndCompletions(context: CompletionContext): Completion[] {
  const openEnvironments = new Set<string>()

  for (const line of context.state.doc.iterRange(0, context.pos)) {
    for (const match of line.matchAll(/\\(?<cmd>begin|end){(?<env>[^}]+)}/g)) {
      const { cmd, env } = match.groups as { cmd: string; env: string }

      if (cmd === 'begin') {
        openEnvironments.add(env)
      } else {
        openEnvironments.delete(env)
      }
    }
  }

  const completions: Completion[] = []

  let boost = 10
  for (const env of openEnvironments) {
    completions.push({
      label: env,
      boost: boost++, // environments opened later rank higher
      apply: createCommandApplier(env),
    })
  }

  return completions
}
