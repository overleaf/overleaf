import { EditorView, ViewPlugin } from '@codemirror/view'
import {
  Compartment,
  Facet,
  StateEffect,
  StateField,
  TransactionSpec,
} from '@codemirror/state'
import { misspelledWordsField, resetMisspelledWords } from './misspelled-words'
import {
  ignoredWordsField,
  resetSpellChecker,
  updateAfterAddingIgnoredWord,
} from './ignored-words'
import { addWordToCache, cacheField, removeWordFromCache } from './cache'
import { spellingMenuField } from './context-menu'
import { SpellChecker } from './spellchecker'
import { parserWatcher } from '../wait-for-parser'

const spellCheckLanguageConf = new Compartment()
const spellCheckLanguageFacet = Facet.define<string | undefined>()

type Options = { spellCheckLanguage?: string }

/*
 * Create the spelling extensions array, based on options passed.
 */
export const spelling = ({ spellCheckLanguage }: Options) => {
  return [
    EditorView.baseTheme({
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
      },
    }),
    parserWatcher,
    spellCheckLanguageConf.of(spellCheckLanguageFacet.of(spellCheckLanguage)),
    spellCheckField,
    misspelledWordsField,
    ignoredWordsField,
    cacheField,
    spellingMenuField,
  ]
}

const spellCheckField = StateField.define<SpellChecker | null>({
  create(state) {
    const [spellCheckLanguage] = state.facet(spellCheckLanguageFacet)
    return spellCheckLanguage ? new SpellChecker(spellCheckLanguage) : null
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSpellCheckLanguageEffect)) {
        value?.destroy()
        return effect.value ? new SpellChecker(effect.value) : null
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
        focus: (event, view) => {
          if (view.state.facet(EditorView.editable)) {
            view.state.field(field)?.spellCheckAsap(view)
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

const setSpellCheckLanguageEffect = StateEffect.define<string | undefined>()

export const setSpelling = ({
  spellCheckLanguage,
}: Options): TransactionSpec => {
  return {
    effects: [
      resetMisspelledWords.of(null),
      spellCheckLanguageConf.reconfigure(
        spellCheckLanguageFacet.of(spellCheckLanguage)
      ),
      setSpellCheckLanguageEffect.of(spellCheckLanguage),
    ],
  }
}

export const addLearnedWord = (
  spellCheckLanguage: string,
  word: string
): TransactionSpec => {
  return {
    effects: [
      addWordToCache.of({
        lang: spellCheckLanguage,
        wordText: word,
        value: true,
      }),
      updateAfterAddingIgnoredWord.of(word),
    ],
  }
}

export const removeLearnedWord = (
  spellCheckLanguage: string,
  word: string
): TransactionSpec => {
  return {
    effects: [
      removeWordFromCache.of({
        lang: spellCheckLanguage,
        wordText: word,
      }),
    ],
  }
}

export const resetLearnedWords = (): TransactionSpec => {
  return {
    effects: [resetSpellChecker.of(null)],
  }
}
