import Hunspell from './wasm/hunspell'
import hunspellWasmPath from './wasm/hunspell.wasm'

type SpellChecker = {
  spell(words: string[]): { index: number }[]
  suggest(word: string): string[]
  addWord(word: string): void
  removeWord(word: string): void
  destroy(): void
}

const createSpellChecker = async ({
  lang,
  learnedWords,
  baseAssetPath,
  dictionariesRoot,
}: {
  lang: string
  learnedWords: string[]
  baseAssetPath: string
  dictionariesRoot: string
}) => {
  const fileLocations: Record<string, string> = {
    'hunspell.wasm': new URL(hunspellWasmPath, baseAssetPath).toString(),
  }

  const hunspell = await Hunspell({
    locateFile(file: string) {
      return fileLocations[file]
    },
  })

  const {
    cwrap,
    FS,
    MEMFS,
    stringToNewUTF8,
    _malloc,
    _free,
    getValue,
    UTF8ToString,
  } = hunspell

  // https://github.com/hunspell/hunspell/blob/master/src/hunspell/hunspell.h
  // https://github.com/kwonoj/hunspell-asm/blob/master/src/wrapHunspellInterface.ts

  const create = cwrap('Hunspell_create', 'number', ['number', 'number'])
  const destroy = cwrap('Hunspell_destroy', 'number', ['number', 'number'])
  const spell = cwrap('Hunspell_spell', 'number', ['number', 'number'])
  const suggest = cwrap('Hunspell_suggest', 'number', [
    'number',
    'number',
    'number',
  ])
  const addWord = cwrap('Hunspell_add', 'number', ['number', 'number'])
  const removeWord = cwrap('Hunspell_remove', 'number', ['number', 'number'])
  const freeList = cwrap('Hunspell_free_list', 'number', [
    'number',
    'number',
    'number',
  ])

  FS.mkdir('/dictionaries')

  const dictionariesRootURL = new URL(dictionariesRoot, baseAssetPath)

  const [dic, aff] = await Promise.all([
    fetch(new URL(`./${lang}.dic`, dictionariesRootURL)).then(response =>
      response.arrayBuffer()
    ),
    fetch(new URL(`./${lang}.aff`, dictionariesRootURL)).then(response =>
      response.arrayBuffer()
    ),
  ])

  FS.mount(MEMFS, {}, '/dictionaries')
  FS.writeFile('/dictionaries/index.dic', new Uint8Array(dic))
  FS.writeFile('/dictionaries/index.aff', new Uint8Array(aff))

  const dicPtr = stringToNewUTF8('/dictionaries/index.dic')
  const affPtr = stringToNewUTF8('/dictionaries/index.aff')
  const spellPtr = create(affPtr, dicPtr)

  for (const word of learnedWords) {
    const wordPtr = stringToNewUTF8(word)
    addWord(spellPtr, wordPtr)
    _free(wordPtr)
  }

  const spellChecker: SpellChecker = {
    spell(words) {
      const misspellings: { index: number }[] = []

      for (const [index, word] of words.entries()) {
        const wordPtr = stringToNewUTF8(word)
        const spellResult = spell(spellPtr, wordPtr)
        _free(wordPtr)

        if (spellResult === 0) {
          misspellings.push({ index })
        }
      }

      return misspellings
    },
    suggest(word) {
      const suggestions: string[] = []

      const suggestionListPtr = _malloc(4)
      const wordPtr = stringToNewUTF8(word)
      const suggestionCount = suggest(spellPtr, suggestionListPtr, wordPtr)
      _free(wordPtr)
      const suggestionListValuePtr = getValue(suggestionListPtr, '*')

      for (let i = 0; i < suggestionCount; i++) {
        const suggestion = UTF8ToString(
          getValue(suggestionListValuePtr + i * 4, '*')
        )
        suggestions.push(suggestion)
      }

      freeList(spellPtr, suggestionListPtr, suggestionCount)
      _free(suggestionListPtr)

      return suggestions
    },
    addWord(word) {
      const wordPtr = stringToNewUTF8(word)
      const result = addWord(spellPtr, wordPtr)
      _free(wordPtr)

      if (result !== 0) {
        throw new Error('The word could not be added to the dictionary')
      }
    },
    removeWord(word) {
      const wordPtr = stringToNewUTF8(word)
      const result = removeWord(spellPtr, wordPtr)
      _free(wordPtr)

      if (result !== 0) {
        throw new Error('The word could not be removed from the dictionary')
      }
    },
    destroy() {
      destroy(spellPtr)
      _free(spellPtr)
      _free(dicPtr)
      _free(affPtr)
    },
  }

  return spellChecker
}

let spellCheckerPromise: Promise<SpellChecker>

self.addEventListener('message', async event => {
  switch (event.data.type) {
    case 'init':
      try {
        spellCheckerPromise = createSpellChecker(event.data)
        await spellCheckerPromise
        self.postMessage({ loaded: true })
      } catch (error) {
        console.error(error)
        self.postMessage({ loadingFailed: error })
      }
      break

    case 'spell':
      {
        const { id, words } = event.data
        try {
          const spellChecker = await spellCheckerPromise
          const misspellings = spellChecker.spell(words)
          self.postMessage({ id, misspellings })
        } catch (error) {
          console.error(error)
          self.postMessage({ id, error: true })
        }
      }
      break

    case 'suggest':
      {
        const { id, word } = event.data
        try {
          const spellChecker = await spellCheckerPromise
          const suggestions = spellChecker.suggest(word)
          self.postMessage({ id, suggestions })
        } catch (error) {
          console.error(error)
          self.postMessage({ id, error: true })
        }
      }
      break

    case 'add_word':
      {
        const { id, word } = event.data
        try {
          const spellChecker = await spellCheckerPromise
          spellChecker.addWord(word)
          self.postMessage({ id })
        } catch (error) {
          console.error(error)
          self.postMessage({ id, error: true })
        }
      }
      break

    case 'remove_word':
      {
        const { id, word } = event.data
        try {
          const spellChecker = await spellCheckerPromise
          spellChecker.removeWord(word)
          self.postMessage({ id })
        } catch (error) {
          console.error(error)
          self.postMessage({ id, error: true })
        }
      }
      break

    case 'destroy':
      {
        const { id } = event.data
        try {
          const spellChecker = await spellCheckerPromise
          spellChecker.destroy()
          self.postMessage({ id })
        } catch (error) {
          console.error(error)
          self.postMessage({ id, error: true })
        }
      }
      break
  }
})

self.postMessage({ listening: true })
