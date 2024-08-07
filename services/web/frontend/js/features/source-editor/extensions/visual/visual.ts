import {
  Compartment,
  EditorState,
  Extension,
  StateEffect,
  StateField,
  TransactionSpec,
} from '@codemirror/state'
import { visualHighlightStyle, visualTheme } from './visual-theme'
import { atomicDecorations } from './atomic-decorations'
import { markDecorations } from './mark-decorations'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { visualKeymap } from './visual-keymap'
import { mousedown, mouseDownEffect } from './selection'
import { forceParsing, syntaxTree } from '@codemirror/language'
import { hasLanguageLoadedEffect } from '../language'
import { restoreScrollPosition } from '../scroll-position'
import { listItemMarker } from './list-item-marker'
import { pasteHtml } from './paste-html'
import { commandTooltip } from '../command-tooltip'
import { tableGeneratorTheme } from './table-generator'
import { debugConsole } from '@/utils/debugging'
import { PreviewPath } from '../../../../../../types/preview-path'

type Options = {
  visual: boolean
  previewByPath: (path: string) => PreviewPath | null
}

const visualConf = new Compartment()

export const toggleVisualEffect = StateEffect.define<boolean>()

const visualState = StateField.define<boolean>({
  create() {
    return false
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleVisualEffect)) {
        return effect.value
      }
    }
    return value
  },
})

const configureVisualExtensions = (options: Options) =>
  options.visual ? extension(options) : []

export const visual = (options: Options): Extension => {
  return [
    visualState.init(() => options.visual),
    visualConf.of(configureVisualExtensions(options)),
  ]
}

export const isVisual = (view: EditorView) => {
  return view.state.field(visualState, false) || false
}

export const setVisual = (options: Options): TransactionSpec => {
  return {
    effects: [
      toggleVisualEffect.of(options.visual),
      visualConf.reconfigure(configureVisualExtensions(options)),
    ],
  }
}

export const sourceOnly = (visual: boolean, extension: Extension) => {
  const conf = new Compartment()
  const configure = (visual: boolean) => (visual ? [] : extension)
  return [
    conf.of(configure(visual)),

    // Respond to switching editor modes
    EditorState.transactionExtender.of(tr => {
      for (const effect of tr.effects) {
        if (effect.is(toggleVisualEffect)) {
          return {
            effects: conf.reconfigure(configure(effect.value)),
          }
        }
      }
      return null
    }),
  ]
}

const parsedAttributesConf = new Compartment()

/**
 * A view plugin which shows the editor content, makes it focusable,
 * and restores the scroll position, once the initial decorations have been applied.
 */
const showContentWhenParsed = [
  parsedAttributesConf.of([EditorView.editable.of(false)]),
  ViewPlugin.define(view => {
    const showContent = () => {
      view.dispatch(
        {
          effects: parsedAttributesConf.reconfigure([
            EditorView.editorAttributes.of({
              class: 'ol-cm-parsed',
            }),
            EditorView.editable.of(true),
          ]),
        },
        restoreScrollPosition()
      )
      view.focus()
    }

    // already parsed
    if (syntaxTree(view.state).length === view.state.doc.length) {
      window.setTimeout(showContent)
      return {}
    }

    // as a fallback, make sure the content is visible after 5s
    const fallbackTimer = window.setTimeout(showContent, 5000)

    let languageLoaded = false

    return {
      update(update) {
        // wait for the language to load before telling the parser to run
        if (!languageLoaded && hasLanguageLoadedEffect(update)) {
          languageLoaded = true
          // in a timeout, as this is already in a dispatch cycle
          window.setTimeout(() => {
            // run asynchronously
            new Promise(() => {
              // tell the parser to run until the end of the document
              forceParsing(view, view.state.doc.length, Infinity)
              // clear the fallback timeout
              window.clearTimeout(fallbackTimer)
              // show the content, in a timeout so the decorations can build first
              window.setTimeout(showContent)
            }).catch(debugConsole.error)
          })
        }
      },
    }
  }),
]

/**
 * A transaction extender which scrolls mouse clicks into view, in case decorations have moved the cursor out of view.
 */
const scrollJumpAdjuster = EditorState.transactionExtender.of(tr => {
  // Attach a "scrollIntoView" effect on all mouse selections to adjust for
  // any jumps that may occur when hiding/showing decorations.
  if (!tr.scrollIntoView) {
    for (const effect of tr.effects) {
      if (effect.is(mouseDownEffect) && effect.value === false) {
        return {
          effects: EditorView.scrollIntoView(tr.newSelection.main.head),
        }
      }
    }
  }

  return {}
})

const extension = (options: Options) => [
  visualTheme,
  visualHighlightStyle,
  mousedown,
  listItemMarker,
  atomicDecorations(options),
  markDecorations, // NOTE: must be after atomicDecorations, so that mark decorations wrap inline widgets
  visualKeymap,
  commandTooltip,
  scrollJumpAdjuster,
  showContentWhenParsed,
  pasteHtml,
  tableGeneratorTheme,
]
