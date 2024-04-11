import {
  StateField,
  StateEffect,
  EditorSelection,
  Prec,
} from '@codemirror/state'
import { EditorView, showTooltip, Tooltip, keymap } from '@codemirror/view'
import { addIgnoredWord } from './ignored-words'
import { learnWordRequest } from './backend'
import { Word, Mark, getMarkAtPosition } from './spellchecker'
import { debugConsole } from '@/utils/debugging'

const ITEMS_TO_SHOW = 8

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

  const { from, to, value } = targetMark

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
    selection: EditorSelection.range(from, to),
    effects: showSpellingMenu.of({
      mark: targetMark,
      word: targetWord,
    }),
  })
}

const handleShortcutEvent = (view: EditorView) => {
  const targetMark = getMarkAtPosition(view, view.state.selection.main.from)

  if (!targetMark || !targetMark.value) {
    return false
  }

  view.dispatch({
    selection: EditorSelection.range(targetMark.from, targetMark.to),
    effects: showSpellingMenu.of({
      mark: targetMark,
      word: targetMark.value.spec.word,
    }),
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
          create: view => {
            return createSpellingSuggestionList(word, view)
          },
        }
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

const hideSpellingMenu = StateEffect.define()

/*
 * Creates the suggestion menu dom, to be displayed in the
 * spelling menu "tooltip"
 * */
const createSpellingSuggestionList = (word: Word, view: EditorView) => {
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
  list.setAttribute('tabindex', '0')
  list.setAttribute('role', 'menu')
  list.addEventListener('keydown', event => {
    if (event.code === 'Tab') {
      // preventing selecting next element
      event.preventDefault()
    }
  })
  list.addEventListener('keyup', event => {
    switch (event.code) {
      case 'ArrowDown': {
        // get currently selected option
        const selectedButton =
          list.querySelector<HTMLButtonElement>('li button:focus')

        if (!selectedButton) {
          return list
            .querySelector<HTMLButtonElement>('li[role="option"] button')
            ?.focus()
        }

        // get next option
        let nextElement = selectedButton.parentElement?.nextElementSibling
        if (nextElement?.getAttribute('role') !== 'option') {
          nextElement = nextElement?.nextElementSibling
        }
        nextElement?.querySelector('button')?.focus()
        break
      }
      case 'ArrowUp': {
        // get currently selected option
        const selectedButton =
          list.querySelector<HTMLButtonElement>('li button:focus')

        if (!selectedButton) {
          return list
            .querySelector<HTMLButtonElement>(
              'li[role="option"]:last-child button'
            )
            ?.focus()
        }

        // get previous option
        let previousElement =
          selectedButton.parentElement?.previousElementSibling
        if (previousElement?.getAttribute('role') !== 'option') {
          previousElement = previousElement?.previousElementSibling
        }
        previousElement?.querySelector('button')?.focus()
        break
      }
      case 'Escape':
      case 'Tab': {
        view.dispatch({
          effects: hideSpellingMenu.of(null),
        })
        view.focus()
        break
      }
    }
  })

  list.classList.add('dropdown-menu', 'dropdown-menu-unpositioned')

  // List items, with links inside
  if (Array.isArray(word.suggestions)) {
    for (const suggestion of word.suggestions.slice(0, ITEMS_TO_SHOW)) {
      const li = makeLinkItem(suggestion, event => {
        const text = (event.target as HTMLElement).innerText
        handleCorrectWord(word, text, view)
        event.preventDefault()
      })
      list.appendChild(li)
    }
  }

  setTimeout(() => {
    list.querySelector<HTMLButtonElement>('li:first-child button')?.focus()
  }, 0)

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
  li.setAttribute('role', 'option')
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
    debugConsole.error(err)
  }
}

/*
 * Correct a word, removing the marked range
 * and replacing it with the chosen text
 */
const handleCorrectWord = (word: Word, text: string, view: EditorView) => {
  const tooltip = view.state.field(spellingMenuField)
  if (!tooltip) {
    throw new Error('No active tooltip')
  }
  const existingText = view.state.doc.sliceString(tooltip.pos, tooltip.end)
  // Defend against erroneous replacement, if the word at this
  // position is not actually what we think it is
  if (existingText !== word.text) {
    debugConsole.debug(
      '>> spelling word-to-correct does not match, stopping',
      tooltip.pos,
      tooltip.end,
      existingText,
      word
    )
    return
  }
  view.dispatch({
    changes: [
      {
        from: tooltip.pos,
        to: tooltip.end,
        insert: text,
      },
    ],
    effects: [hideSpellingMenu.of(null)],
  })
  view.focus()
}
