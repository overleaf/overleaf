import topHundredSnippets from './data/top-hundred-snippets'
import snippets from './data/snippets'
import { customSnippetCompletion } from './apply'
import { Completions } from './types'

/**
 * Completions based on bundled snippets
 */
export function buildSnippetCompletions(completions: Completions) {
  for (const item of topHundredSnippets) {
    completions.commands.push(
      customSnippetCompletion(item.snippet, {
        type: item.meta,
        label: item.caption,
        boost: item.score,
      })
    )
  }

  for (const item of snippets) {
    completions.commands.push(
      customSnippetCompletion(item.snippet, {
        type: item.type,
        label: item.label,
      })
    )
  }
}
