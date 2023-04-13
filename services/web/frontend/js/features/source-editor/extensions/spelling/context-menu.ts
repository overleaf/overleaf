import {
  StateField,
  StateEffect,
  Range,
  RangeValue,
  EditorSelection,
} from '@codemirror/state'
import { EditorView, showTooltip, Tooltip } from '@codemirror/view'
import { misspelledWordsField } from './misspelled-words'
import { addIgnoredWord } from './ignored-words'
import { learnWordRequest } from './backend'
import { Word } from './spellchecker'

const ITEMS_TO_SHOW = 8

type Mark = Range<RangeValue & { spec: { word: Word } }>

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

  const marks = view.state.field(misspelledWordsField)

  let targetMark: Mark | null = null
  marks.between(view.viewport.from, view.viewport.to, (from, to, value) => {
    if (position >= from && position <= to) {
      targetMark = { from, to, value }
      return false
    }
  })
  if (!targetMark) {
    return
  }

  const { from, to, value } = targetMark as Mark

  const targetWord = value.spec.word
  if (!targetWord) {
    console.debug(
      '>> spelling no word associated with decorated range, stopping'
    )
    return
  }

  event.preventDefault()

  openingUntil = Date.now() + 100

  view.dispatch({
    selection: EditorSelection.range(from, to),
    effects: showSpellingMenu.of({
      mark: targetMark,
      word: targetWord,
    }),
  })
}

/*
 * Spelling menu "tooltip" field.
 * Manages the menu of suggestions shown on right-click
 */
export const spellingMenuField = StateField.define<Tooltip | null>({
  create() {
    return null
  },
  update(menu, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(hideSpellingMenu)) {
        return null
      } else if (effect.is(showSpellingMenu)) {
        const { mark, word } = effect.value
        // Build a "Tooltip" showing the suggestions
        return {
          pos: mark.from,
          above: false,
          strictSide: false,
          create: view => {
            return createSpellingSuggestionList(mark, word, view)
          },
        }
      }
    }
    return menu
  },
  provide: field => {
    return [
      showTooltip.from(field),
      EditorView.domEventHandlers({
        contextmenu: handleContextMenuEvent,
        click: handleClickEvent,
      }),
    ]
  },
})

const showSpellingMenu = StateEffect.define<{ mark: Mark; word: Word }>()

const hideSpellingMenu = StateEffect.define()

/*
 * Creates the suggestion menu dom, to be displayed in the
 * spelling menu "tooltip"
 * */
const createSpellingSuggestionList = (
  mark: Mark,
  word: Word,
  view: EditorView
) => {
  // Wrapper div.
  // Note, CM6 doesn't like showing complex elements
  // 'inside' its Tooltip element, so we style this
  // wrapper div to be basically invisible, and allow
  // the dropdown list to hang off of it, giving the illusion that
  // the list _is_ the tooltip.
  // See the theme in spelling/index for styling that makes this work.
  const dom = document.createElement('div')
  dom.classList.add('ol-cm-spelling-context-menu-tooltip')

  // List
  const list = document.createElement('ul')
  list.classList.add('dropdown-menu', 'dropdown-menu-unpositioned')

  // List items, with links inside
  if (Array.isArray(word.suggestions)) {
    for (const suggestion of word.suggestions.slice(0, ITEMS_TO_SHOW)) {
      const li = makeLinkItem(suggestion, event => {
        const text = (event.target as HTMLElement).innerText
        handleCorrectWord(mark, word, text, view)
        event.preventDefault()
      })
      list.appendChild(li)
    }
  }

  // Divider
  const divider = document.createElement('li')
  divider.classList.add('divider')
  list.append(divider)

  // Add to Dictionary
  const addToDictionary = makeLinkItem(
    'Add to Dictionary',
    async function (event: Event) {
      await handleLearnWord(word, view)
      event.preventDefault()
    }
  )
  list.append(addToDictionary)

  dom.appendChild(list)
  return { dom }
}

const makeLinkItem = (suggestion: string, handler: EventListener) => {
  const li = document.createElement('li')
  const button = document.createElement('button')
  button.classList.add('btn-link', 'text-left', 'dropdown-menu-button')
  button.onclick = handler
  button.textContent = suggestion
  li.appendChild(button)
  return li
}

/*
 * Learn a word, adding it to the local cache
 * and sending it to the spelling backend
 */
const handleLearnWord = async function (word: Word, view: EditorView) {
  try {
    await learnWordRequest(word)
    view.dispatch({
      effects: [addIgnoredWord.of(word), hideSpellingMenu.of(null)],
    })
  } catch (err) {
    console.error(err)
  }
}

/*
 * Correct a word, removing the marked range
 * and replacing it with the chosen text
 */
const handleCorrectWord = (
  mark: Mark,
  word: Word,
  text: string,
  view: EditorView
) => {
  const existingText = view.state.doc.sliceString(mark.from, mark.to)
  // Defend against erroneous replacement, if the word at this
  // position is not actually what we think it is
  if (existingText !== word.text) {
    console.debug(
      '>> spelling word-to-correct does not match, stopping',
      mark,
      existingText,
      word
    )
    return
  }
  view.dispatch({
    changes: [
      {
        from: mark.from,
        to: mark.to,
        insert: text,
      },
    ],
    effects: [hideSpellingMenu.of(null)],
  })
}
