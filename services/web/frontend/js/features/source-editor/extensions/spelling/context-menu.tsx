import { createRoot } from 'react-dom/client'
import {
  StateField,
  StateEffect,
  Prec,
  EditorSelection,
} from '@codemirror/state'
import { EditorView, showTooltip, Tooltip, keymap } from '@codemirror/view'
import { Word, Mark, getMarkAtPosition } from './spellchecker'
import { debugConsole } from '@/utils/debugging'
import {
  getSpellChecker,
  getSpellCheckLanguage,
} from '@/features/source-editor/extensions/spelling/index'
import { sendMB } from '@/infrastructure/event-tracking'
import { SpellingSuggestions } from '@/features/source-editor/extensions/spelling/spelling-suggestions'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { addLearnedWord } from '@/features/source-editor/extensions/spelling/learned-words'
import { postJSON } from '@/infrastructure/fetch-json'
import { closeAllContextMenusEffect } from '../../utils/close-all-context-menus-effect'

/*
 * The time until which a click event will be ignored, so it doesn't immediately close the spelling menu.
 * Safari emits an additional "click" event when event.preventDefault() is called in the "contextmenu" event listener.
 */
let openingUntil = 0

/*
 * Hide the spelling menu on click
 */
const handleClickEvent = (event: MouseEvent, view: EditorView) => {
  if (Date.now() < openingUntil) {
    return
  }

  if (view.state.field(spellingMenuField, false)) {
    view.dispatch({
      effects: hideSpellingMenu.of(null),
    })
  }
}

/*
 * Detect when the user right-clicks on a misspelled word,
 * and show a menu of suggestions
 */
const handleContextMenuEvent = (event: MouseEvent, view: EditorView) => {
  const position = view.posAtCoords(
    {
      x: event.pageX,
      y: event.pageY,
    },
    false
  )
  const targetMark = getMarkAtPosition(view, position)

  if (!targetMark) {
    return
  }

  const { value } = targetMark

  const targetWord = value.spec.word
  if (!targetWord) {
    debugConsole.debug(
      '>> spelling no word associated with decorated range, stopping'
    )
    return
  }

  event.preventDefault()

  openingUntil = Date.now() + 100

  view.dispatch({
    effects: [
      closeAllContextMenusEffect.of(null),
      showSpellingMenu.of({
        mark: targetMark,
        word: targetWord,
      }),
    ],
  })
}

const handleShortcutEvent = (view: EditorView) => {
  const targetMark = getMarkAtPosition(view, view.state.selection.main.from)

  if (!targetMark || !targetMark.value) {
    return false
  }

  view.dispatch({
    effects: [
      closeAllContextMenusEffect.of(null),
      showSpellingMenu.of({
        mark: targetMark,
        word: targetMark.value.spec.word,
      }),
    ],
  })

  return true
}

/*
 * Spelling menu "tooltip" field.
 * Manages the menu of suggestions shown on right-click
 */
export const spellingMenuField = StateField.define<Tooltip | null>({
  create() {
    return null
  },
  update(value, transaction) {
    if (value) {
      value = {
        ...value,
        pos: transaction.changes.mapPos(value.pos),
        end: value.end ? transaction.changes.mapPos(value.end) : undefined,
      }
    }

    for (const effect of transaction.effects) {
      if (effect.is(hideSpellingMenu)) {
        value = null
      } else if (effect.is(showSpellingMenu)) {
        const { mark, word } = effect.value
        // Build a "Tooltip" showing the suggestions
        value = {
          pos: mark.from,
          end: mark.to,
          above: false,
          strictSide: false,
          create: createSpellingSuggestionList(word),
        }
      } else if (effect.is(closeAllContextMenusEffect)) {
        value = null
      }
    }
    return value
  },
  provide: field => {
    return [
      showTooltip.from(field),
      EditorView.domEventHandlers({
        contextmenu: handleContextMenuEvent,
        click: handleClickEvent,
      }),
      Prec.highest(
        keymap.of([
          { key: 'Ctrl-Space', run: handleShortcutEvent },
          { key: 'Alt-Space', run: handleShortcutEvent },
        ])
      ),
    ]
  },
})

const showSpellingMenu = StateEffect.define<{ mark: Mark; word: Word }>()

export const hideSpellingMenu = StateEffect.define()

/*
 * Creates the suggestion menu dom, to be displayed in the
 * spelling menu "tooltip"
 * */
const createSpellingSuggestionList = (word: Word) => (view: EditorView) => {
  const dom = document.createElement('div')
  dom.classList.add('ol-cm-spelling-context-menu-tooltip')

  const root = createRoot(dom)
  root.render(
    <SplitTestProvider>
      <SpellingSuggestions
        word={word}
        spellCheckLanguage={getSpellCheckLanguage(view.state)}
        spellChecker={getSpellChecker(view.state)}
        handleClose={(focus = true) => {
          view.dispatch({
            effects: hideSpellingMenu.of(null),
          })
          if (focus) {
            view.focus()
          }
        }}
        handleLearnWord={() => {
          const tooltip = view.state.field(spellingMenuField)
          if (tooltip) {
            window.setTimeout(() => {
              view.dispatch({
                selection: EditorSelection.cursor(tooltip.end ?? tooltip.pos),
              })
            })
          }
          view.focus()

          postJSON('/spelling/learn', {
            body: {
              word: word.text,
            },
          })
            .then(() => {
              view.dispatch(addLearnedWord(word.text), {
                effects: hideSpellingMenu.of(null),
              })
              sendMB('spelling-word-added', {
                language: getSpellCheckLanguage(view.state),
              })
            })
            .catch(error => {
              debugConsole.error(error)
            })
        }}
        handleCorrectWord={(text: string) => {
          const tooltip = view.state.field(spellingMenuField)
          if (!tooltip) {
            throw new Error('No active tooltip')
          }

          const existingText = view.state.doc.sliceString(
            tooltip.pos,
            tooltip.end
          )
          if (existingText !== word.text) {
            return
          }

          window.setTimeout(() => {
            const changes = view.state.changes([
              { from: tooltip.pos, to: tooltip.end, insert: text },
            ])

            view.dispatch({
              changes,
              effects: [hideSpellingMenu.of(null)],
              selection: EditorSelection.cursor(tooltip.end ?? tooltip.pos).map(
                changes
              ),
            })
          })
          view.focus()

          sendMB('spelling-suggestion-click', {
            language: getSpellCheckLanguage(view.state),
          })
        }}
      />
    </SplitTestProvider>
  )

  const destroy = () => {
    root.unmount()
  }

  return { dom, destroy }
}
