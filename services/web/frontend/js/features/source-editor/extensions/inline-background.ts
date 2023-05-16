import { Annotation, Compartment } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { themeOptionsChange } from './theme'
import { sourceOnly } from './visual/visual'
import { round } from 'lodash'
import { hasLanguageLoadedEffect } from './language'
import { fontLoad, hasFontLoadedEffect } from './font-load'

const themeConf = new Compartment()
const changeHalfLeadingAnnotation = Annotation.define<boolean>()

function firstVisibleNonSpacePos(view: EditorView) {
  for (const range of view.visibleRanges) {
    const match = /\S/.exec(view.state.sliceDoc(range.from, range.to))
    if (match) {
      return range.from + match.index
    }
  }
  return null
}

function measureHalfLeading(view: EditorView) {
  const pos = firstVisibleNonSpacePos(view)
  if (pos === null) {
    return 0
  }

  const coords = view.coordsAtPos(pos)
  if (!coords) {
    return 0
  }
  const inlineBoxHeight = coords.bottom - coords.top

  // Rounding prevents gaps appearing in some situations
  return round((view.defaultLineHeight - inlineBoxHeight) / 2, 2)
}

function createTheme(halfLeading: number) {
  return EditorView.theme({
    '.cm-content': {
      '--half-leading': halfLeading + 'px',
    },
  })
}

const plugin = ViewPlugin.define(
  view => {
    let halfLeading = 0

    const measureRequest = {
      read: () => {
        return measureHalfLeading(view)
      },

      write: (newHalfLeading: number) => {
        if (newHalfLeading !== halfLeading) {
          halfLeading = newHalfLeading
          window.setTimeout(() =>
            view.dispatch({
              effects: themeConf.reconfigure(createTheme(newHalfLeading)),
              annotations: changeHalfLeadingAnnotation.of(true),
            })
          )
        }
      },
    }

    return {
      update(update) {
        // Ignore any update triggered by this plugin
        if (
          update.transactions.some(tr =>
            tr.annotation(changeHalfLeadingAnnotation)
          )
        ) {
          return
        }
        if (
          hasFontLoadedEffect(update) ||
          (update.geometryChanged && !update.docChanged) ||
          update.transactions.some(tr => tr.annotation(themeOptionsChange)) ||
          hasLanguageLoadedEffect(update)
        ) {
          view.requestMeasure(measureRequest)
        }
      },
    }
  },
  {
    provide: () => [themeConf.of(createTheme(0))],
  }
)

export const inlineBackground = (visual: boolean) => {
  return sourceOnly(visual, [fontLoad, plugin])
}
