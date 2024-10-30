import { postJSON } from '@/infrastructure/fetch-json'
import { Word } from './spellchecker'

export async function learnWordRequest(word?: Word) {
  if (!word || !word.text) {
    throw new Error(`Invalid word supplied: ${word}`)
  }
  return await postJSON('/spelling/learn', {
    body: {
      word: word.text,
    },
  })
}
