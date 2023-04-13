import { ViewPlugin } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export const symbolPalette = () => {
  return ViewPlugin.define(view => {
    const listener = (event: Event) => {
      const symbol = (event as CustomEvent<{ command: string }>).detail

      view.focus()

      const spec = view.state.changeByRange(range => {
        const changeSet = view.state.changes([
          {
            from: range.from,
            to: range.to,
            insert: symbol.command,
          },
        ])

        return {
          range: EditorSelection.cursor(changeSet.mapPos(range.to, 1)),
          changes: changeSet,
        }
      })

      view.dispatch(spec, {
        scrollIntoView: true,
      })
    }

    window.addEventListener('editor:insert-symbol', listener)

    return {
      destroy() {
        window.removeEventListener('editor:insert-symbol', listener)
      },
    }
  })
}
