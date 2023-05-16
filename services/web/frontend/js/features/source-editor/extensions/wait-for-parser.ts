import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { syntaxTreeAvailable } from '@codemirror/language'
import { EditorState } from '@codemirror/state'

// Either a number representing the document position the parser needs to have
// reached or a function that returns a document position. This covers the case
// when the requirements change while waiting for the parser, such as when
// scrolling.
type UpTo = number | ((view: EditorView) => number)

type ParserWait = {
  promise: Promise<void>
  upTo?: UpTo
  resolve: () => void
}

export const parserWatcher = ViewPlugin.fromClass(
  class {
    waits: ParserWait[] = []

    // eslint-disable-next-line no-useless-constructor
    constructor(readonly view: EditorView) {}

    parserReady(wait: ParserWait, state: EditorState) {
      const upTo =
        typeof wait.upTo === 'function' ? wait.upTo(this.view) : wait.upTo
      return syntaxTreeAvailable(state, upTo)
    }

    wait(upTo?: UpTo) {
      const promise = new Promise<void>(resolve => {
        const wait = {
          promise,
          upTo,
          resolve,
        }

        // Resolve immediately if the parser is ready. Otherwise, watch for
        // updates.
        if (this.parserReady(wait, this.view.state)) {
          wait.resolve()
        } else {
          this.waits.push(wait)
        }
      })

      return promise
    }

    update(update: ViewUpdate) {
      const unresolvedWaits: ParserWait[] = []
      for (const wait of this.waits) {
        if (this.parserReady(wait, update.state)) {
          wait.resolve()
        } else {
          unresolvedWaits.push(wait)
        }
      }
      this.waits = unresolvedWaits
    }
  }
)

// Returns a promise that is resolved as soon as CM6 reports that the parser is
// ready, up to a specified offset in the document or the end if none is
// specified. CM6 dispatches a transaction after every chunk of parser work
// and the view plugin checks after each, so there is minimal delay
export function waitForParser(view: EditorView, upTo?: UpTo) {
  const pluginInstance = view.plugin(parserWatcher)
  if (!pluginInstance) {
    throw new Error('No parser watcher view plugin found')
  }
  return pluginInstance.wait(upTo)
}
