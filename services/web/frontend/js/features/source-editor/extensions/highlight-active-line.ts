import {
  Decoration,
  DecorationSet,
  EditorView,
  layer,
  LayerMarker,
  RectangleMarker,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import { sourceOnly } from './visual/visual'
import { fullHeightCoordsAtPos } from '../utils/layer'

export const highlightActiveLine = (visual: boolean) => {
  // this extension should only be active in the source editor
  return sourceOnly(visual, [
    activeLineLayer,
    singleLineHighlighter,
    EditorView.baseTheme({
      '.ol-cm-activeLineLayer': {
        pointerEvents: 'none',
      },
    }),
  ])
}

/**
 * Line decoration approach used for non-wrapped lines, adapted from built-in
 * CodeMirror 6 highlightActiveLine, licensed under the MIT license:
 * https://github.com/codemirror/view/blob/main/src/active-line.ts
 */
const lineDeco = Decoration.line({ class: 'cm-activeLine' })

const singleLineHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.getDeco(view)
    }

    update(update: ViewUpdate) {
      if (update.geometryChanged || update.selectionSet) {
        this.decorations = this.getDeco(update.view)
      }
    }

    getDeco(view: EditorView) {
      const deco = []

      // NOTE: only highlighting the active line for the main selection
      const { main } = view.state.selection

      // No active line highlight when text is selected
      if (main.empty) {
        const line = view.lineBlockAt(main.head)
        if (line.height <= view.defaultLineHeight) {
          deco.push(lineDeco.range(line.from))
        }
      }

      return Decoration.set(deco)
    }
  },
  {
    decorations: v => v.decorations,
  }
)

// Custom layer approach, used only for wrapped lines
const activeLineLayer = layer({
  above: false,
  class: 'ol-cm-activeLineLayer',
  markers(view: EditorView): readonly LayerMarker[] {
    const markers: LayerMarker[] = []

    // NOTE: only highlighting the active line for the main selection
    const { main } = view.state.selection

    // no active line highlight when text is selected
    if (!main.empty) {
      return markers
    }

    // Use line decoration when line doesn't wrap
    if (view.lineBlockAt(main.head).height <= view.defaultLineHeight) {
      return markers
    }

    const coords = fullHeightCoordsAtPos(
      view,
      main.head,
      main.assoc || undefined
    )

    if (coords) {
      const scrollRect = view.scrollDOM.getBoundingClientRect()
      const contentRect = view.contentDOM.getBoundingClientRect()
      const scrollTop = view.scrollDOM.scrollTop

      const top = coords.top - scrollRect.top + scrollTop
      const left = contentRect.left - scrollRect.left
      const width = contentRect.right - contentRect.left
      const height = coords.bottom - coords.top

      markers.push(
        new RectangleMarker('cm-activeLine', left, top, width, height)
      )
    }

    return markers
  },
  update(update: ViewUpdate): boolean {
    return update.geometryChanged || update.selectionSet
  },
})
