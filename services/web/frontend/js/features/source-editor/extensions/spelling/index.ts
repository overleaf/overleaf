import { EditorView, ViewPlugin } from '@codemirror/view'
import {
  EditorState,
  StateEffect,
  StateField,
  TransactionSpec,
} from '@codemirror/state'
import { misspelledWordsField } from './misspelled-words'
import { removeLearnedWord } from './learned-words'
import { cacheField } from './cache'
import { hideSpellingMenu, spellingMenuField } from './context-menu'
import { SpellChecker } from './spellchecker'
import { parserWatcher } from '../wait-for-parser'
import type { HunspellManager } from '@/features/source-editor/hunspell/HunspellManager'

type Options = {
  spellCheckLanguage?: string
  hunspellManager?: HunspellManager
}

/**
 * A custom extension that creates a spell checker for the current language (from the user settings).
 * The spell check runs on the server whenever a line changes.
 * The mis-spelled words, ignored words and spell-checked words are stored in a state field.
 * Mis-spelled words are decorated with a Mark decoration.
 * The suggestions menu is displayed in a tooltip, activated with a right-click on the decoration.
 */
export const spelling = ({ spellCheckLanguage, hunspellManager }: Options) => {
  return [
    spellingTheme,
    parserWatcher,
    spellCheckLanguageField.init(() => spellCheckLanguage),
    spellCheckerField.init(() =>
      spellCheckLanguage
        ? new SpellChecker(spellCheckLanguage, hunspellManager)
        : null
    ),
    misspelledWordsField,
    cacheField,
    spellingMenuField,
    dictionary,
  ]
}

const dictionary = ViewPlugin.define(view => {
  const listener = (event: Event) => {
    view.dispatch(removeLearnedWord((event as CustomEvent<string>).detail))
  }

  window.addEventListener('editor:remove-learned-word', listener)

  return {
    destroy() {
      window.removeEventListener('editor:remove-learned-word', listener)
    },
  }
})

const spellingTheme = EditorView.baseTheme({
  '.ol-cm-spelling-error': {
    textDecorationColor: 'red',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationThickness: '2px',
    textDecorationSkipInk: 'none',
    textUnderlineOffset: '0.2em',
  },
  '.cm-tooltip.ol-cm-spelling-context-menu-tooltip': {
    borderWidth: '0',
    background: 'transparent',
  },
})

export const getSpellChecker = (state: EditorState) =>
  state.field(spellCheckerField, false)

const spellCheckerField = StateField.define<SpellChecker | null>({
  create() {
    return null
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSpellCheckLanguageEffect)) {
        value?.destroy()
        value = effect.value.spellCheckLanguage
          ? new SpellChecker(
              effect.value.spellCheckLanguage,
              effect.value.hunspellManager
            )
          : null
      }
    }
    return value
  },
  provide(field) {
    return [
      ViewPlugin.define(view => {
        return {
          destroy: () => {
            view.state.field(field)?.destroy()
          },
        }
      }),
      EditorView.domEventHandlers({
        focus: (_event, view) => {
          if (view.state.facet(EditorView.editable)) {
            view.state.field(field)?.scheduleSpellCheck(view)
          }
        },
      }),
      EditorView.updateListener.of(update => {
        if (update.state.facet(EditorView.editable)) {
          update.state.field(field)?.handleUpdate(update)
        }
      }),
    ]
  },
})

export const getSpellCheckLanguage = (state: EditorState) =>
  state.field(spellCheckLanguageField, false)

const spellCheckLanguageField = StateField.define<string | undefined>({
  create() {
    return undefined
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSpellCheckLanguageEffect)) {
        value = effect.value.spellCheckLanguage
      }
    }
    return value
  },
})

export const setSpellCheckLanguageEffect = StateEffect.define<{
  spellCheckLanguage: string | undefined
  hunspellManager?: HunspellManager
}>()

export const setSpellCheckLanguage = ({
  spellCheckLanguage,
  hunspellManager,
}: Options): TransactionSpec => {
  return {
    effects: [
      setSpellCheckLanguageEffect.of({
        spellCheckLanguage,
        hunspellManager,
      }),
      hideSpellingMenu.of(null),
    ],
  }
}
