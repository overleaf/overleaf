import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from '@codemirror/view'
import browser from './browser'

class EmptyLineWidget extends WidgetType {
  toDOM(): HTMLElement {
    const element = document.createElement('span')
    element.className = 'ol-cm-filler'
    return element
  }

  eq() {
    return true
  }
}

/**
 * A custom extension which adds a widget decoration at the start of each empty line in the viewport,
 * so that the line is highlighted when part of tracked changes.
 */
export const emptyLineFiller = () => {
  if (browser.ios) {
    // disable on iOS as it breaks Backspace across empty lines
    // https://github.com/overleaf/internal/issues/12192
    return []
  }

  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet

        constructor(view: EditorView) {
          this.decorations = this.buildDecorations(view)
        }

        update(update: ViewUpdate) {
          if (update.docChanged || update.viewportChanged)
            this.decorations = this.buildDecorations(update.view)
        }

        buildDecorations(view: EditorView) {
          const decorations = []
          const { from, to } = view.viewport
          const { doc } = view.state
          let pos = from
          while (pos <= to) {
            const line = doc.lineAt(pos)
            if (line.length === 0) {
              const decoration = Decoration.widget({
                widget: new EmptyLineWidget(),
                side: 1,
              })
              decorations.push(decoration.range(pos))
            }
            pos = line.to + 1
          }
          return Decoration.set(decorations)
        }
      },
      {
        decorations(value) {
          return value.decorations
        },
      }
    ),
    emptyLineFillerTheme,
  ]
}

const emptyLineFillerTheme = EditorView.baseTheme({
  '.ol-cm-filler': {
    padding: '0 2px',
  },
})
