import { environments, snippet } from './data/environments'
import { applySnippet, extendOverUnpairedClosingBrace } from './apply'
import { Completion, CompletionContext } from '@codemirror/autocomplete'
import { Completions } from './types'

/**
 * Environments from bundled data
 */
export function buildEnvironmentCompletions(completions: Completions) {
  for (const [item, snippet] of environments) {
    // clear snippet for some environments after inserting
    const clear =
      item === 'abstract' || item === 'itemize' || item === 'enumerate'
    completions.commands.push({
      type: 'env',
      label: `\\begin{${item}} …`,
      apply: applySnippet(snippet, clear),
      extend: extendOverUnpairedClosingBrace,
    })
  }
}

/**
 * A `begin` environment completion with a snippet, for the current context
 */
export function customBeginCompletion(name: string): Completion | null {
  if (environments.has(name)) {
    return null
  }

  return {
    label: `\\begin{${name}} …`,
    apply: applySnippet(snippet(name)),
    extend: extendOverUnpairedClosingBrace,
  }
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
    })
  }

  return completions
}
