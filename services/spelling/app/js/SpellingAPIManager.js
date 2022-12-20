// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import { callbackify } from 'node:util'
import OError from '@overleaf/o-error'
import * as ASpell from './ASpell.js'

// The max number of words checked in a single request
const REQUEST_LIMIT = 10000

export const promises = {}

promises.runRequest = async (token, request) => {
  if (!request.words) {
    throw new OError('malformed JSON')
  }
  const lang = request.language || 'en'

  // only the first 10K words are checked
  const wordSlice = request.words.slice(0, REQUEST_LIMIT)

  const misspellings = await ASpell.promises.checkWords(lang, wordSlice)
  return { misspellings }
}

export const runRequest = callbackify(promises.runRequest)
