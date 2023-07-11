import { ViewPlugin } from '@codemirror/view'
import { emitShortcutEvent } from './toolbar/utils/analytics'
import { runShortcut } from '../languages/latex/shortcuts'

/**
 * A custom view plugin that watches for transactions with the `runShortcut` annotation,
 * and logs the shortcut name for analytics.
 */
export const shortcutLogger = ViewPlugin.define(view => {
  return {
    update(update) {
      for (const tr of update.transactions) {
        const action = tr.annotation(runShortcut)
        if (action) {
          emitShortcutEvent(view, action)
        }
      }
    },
  }
})
