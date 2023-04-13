import { postJSON } from '../../../../infrastructure/fetch-json'
import { Word } from './spellchecker'

const apiUrl = (path: string) => {
  return `/spelling${path}`
}

export async function learnWordRequest(word?: Word) {
  if (!word || !word.text) {
    throw new Error(`Invalid word supplied: ${word}`)
  }
  return await postJSON(apiUrl('/learn'), {
    body: {
      word: word.text,
    },
  })
}

export function spellCheckRequest(
  language: string,
  words: Word[],
  controller: AbortController
) {
  const signal = controller.signal
  const textWords = words.map(w => w.text)
  return postJSON<{
    misspellings: { index: number; suggestions: string[] }[]
  }>(apiUrl('/check'), {
    body: {
      language,
      words: textWords,
    },
    signal,
  })
}
