import { ViewPlugin } from '@codemirror/view'
import { pickedCompletion } from '@codemirror/autocomplete'
import { emitCompletionEvent } from './toolbar/utils/analytics'

/**
 * A custom view plugin that watches for transactions with the `pickedCompletion` annotation.
 * If the completion label starts with a command, log that command for analytics.
 */
export const completionLogger = ViewPlugin.define(view => {
  return {
    update(update) {
      for (const tr of update.transactions) {
        const completion = tr.annotation(pickedCompletion)
        if (completion) {
          const command = completionCommand(completion.label)
          if (command) {
            emitCompletionEvent(view, command)
          }
        }
      }
    },
  }
})

const completionCommand = (label: string): string | null => {
  const matches = label.match(/^(\\\w+)/)
  return matches ? matches[1] : null
}
