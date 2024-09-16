import { customBeginCompletion } from './environments'
import { CompletionContext } from '@codemirror/autocomplete'
import { documentEnvironments } from '../document-environments'
import { ProjectionResult } from '../../../utils/tree-operations/projection'
import { Environment } from '../../../utils/tree-operations/environments'

/**
 * Environments from the current doc
 */
export function customEnvironmentCompletions(context: CompletionContext) {
  const items = findEnvironmentsInDoc(context)

  const completions = []

  for (const env of items.values()) {
    const completion = customBeginCompletion(env)
    if (completion) {
      completions.push(completion)
    }
  }

  return completions
}

export const findEnvironmentsInDoc = (context: CompletionContext) => {
  const result = new Set<string>()

  const environmentNamesProjection: ProjectionResult<Environment> =
    context.state.field(documentEnvironments)
  if (!environmentNamesProjection || !environmentNamesProjection.items) {
    return result
  }

  for (const environment of environmentNamesProjection.items) {
    // include the environment name if it's outside the current context
    if (environment.to < context.pos || environment.from > context.pos) {
      result.add(environment.title)
    }
  }

  return result
}
