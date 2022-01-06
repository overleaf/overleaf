// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const ASpell = require('./ASpell')
const { callbackify } = require('util')
const OError = require('@overleaf/o-error')

// The max number of words checked in a single request
const REQUEST_LIMIT = 10000

const SpellingAPIManager = {}

const promises = {
  async runRequest(token, request) {
    if (!request.words) {
      throw new OError('malformed JSON')
    }
    const lang = request.language || 'en'

    // only the first 10K words are checked
    const wordSlice = request.words.slice(0, REQUEST_LIMIT)

    const misspellings = await ASpell.promises.checkWords(lang, wordSlice)
    return { misspellings }
  },
}

SpellingAPIManager.runRequest = callbackify(promises.runRequest)
SpellingAPIManager.promises = promises

module.exports = SpellingAPIManager
