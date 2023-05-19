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
import { skipPreambleWithCursor } from './skip-preamble-cursor'
import { mouseDownEffect, mouseDownListener } from './selection'
import { findEffect } from '../../utils/effects'
import { forceParsing, syntaxTree } from '@codemirror/language'
import { hasLanguageLoadedEffect } from '../language'
import { restoreScrollPosition } from '../scroll-position'
import { toolbarPanel } from '../toolbar/toolbar-panel'
import { CurrentDoc } from '../../../../../../types/current-doc'
import isValidTeXFile from '../../../../main/is-valid-tex-file'
import { listItemMarker } from './list-item-marker'
import { figureModalPasteHandler } from '../figure-modal'

type Options = {
  visual: boolean
  fileTreeManager: {
    getPreviewByPath: (
      path: string
    ) => { url: string; extension: string } | null
  }
}

const visualConf = new Compartment()

export const toggleVisualEffect = StateEffect.define<boolean>()
export const findToggleVisualEffect = findEffect(toggleVisualEffect)

const visualState = StateField.define<boolean>({
  create() {
    return false
  },
  update(value, tr) {
    return findToggleVisualEffect(tr)?.value ?? value
  },
})

const configureVisualExtensions = (options: Options) =>
  options.visual ? extension(options) : []

export const visual = (currentDoc: CurrentDoc, options: Options): Extension => {
  if (!isValidTeXFile(currentDoc.docName)) {
    return []
  }

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
      const effect = findToggleVisualEffect(tr)
      if (effect) {
        return {
          effects: conf.reconfigure(configure(effect.value)),
        }
      }
      return null
    }),

    // restore the scroll position when switching to source mode
    EditorView.updateListener.of(update => {
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(toggleVisualEffect)) {
            if (!effect.value) {
              // switching to the source editor
              window.setTimeout(() => {
                update.view.dispatch(restoreScrollPosition())
                update.view.focus()
              })
            }
          }
        }
      }
    }),
  ]
}

const parsedAttributesConf = new Compartment()
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
            }).catch(error => {
              console.error(error)
            })
          })
        }
      },
    }
  }),
]

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
  mouseDownListener,
  listItemMarker,
  markDecorations,
  atomicDecorations(options),
  skipPreambleWithCursor,
  visualKeymap,
  toolbarPanel(),
  scrollJumpAdjuster,
  showContentWhenParsed,
  figureModalPasteHandler(),
]
