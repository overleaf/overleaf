// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const ASpell = require('./ASpell')
const LearnedWordsManager = require('./LearnedWordsManager')
const { callbackify } = require('util')
const _ = require('underscore')

// The max number of words checked in a single request
const REQUEST_LIMIT = 10000

// Size of each chunk of words sent to Aspell checker
const CHUNK_SIZE = 1000

const SpellingAPIManager = {
  whitelist: ['ShareLaTeX', 'sharelatex', 'LaTeX', 'http', 'https', 'www'],

  learnWord(token, request, callback) {
    if (callback == null) {
      callback = () => {}
    }
    if (request.word == null) {
      return callback(new Error('malformed JSON'))
    }
    if (token == null) {
      return callback(new Error('no token provided'))
    }

    return LearnedWordsManager.learnWord(token, request.word, callback)
  },

  deleteDic(token, callback) {
    return LearnedWordsManager.deleteUsersLearnedWords(token, callback)
  },

  getDic(token, callback) {
    return LearnedWordsManager.getLearnedWords(token, callback)
  }
}

const promises = {
  async runRequest(token, request) {
    if (!request.words) {
      throw new Error('malformed JSON')
    }
    const lang = request.language || 'en'

    // only the first 10K words are checked
    const wordSlice = request.words.slice(0, REQUEST_LIMIT)

    // word list is splitted into chunks and sent to Aspell concurrently
    const chunks = _.chunk(wordSlice, CHUNK_SIZE)
    const chunkResults = await Promise.all(
      chunks.map(chunk => ASpell.promises.checkWords(lang, chunk))
    )

    // indexes have to be reconstructed for each chunk
    chunkResults.forEach((result, chunkIndex) =>
      result.forEach(msp => (msp.index += chunkIndex * CHUNK_SIZE))
    )

    // the final misspellings object is created merging all the chunks
    const misspellings = _.flatten(chunkResults)

    if (token) {
      const learnedWords = await LearnedWordsManager.promises.getLearnedWords(
        token
      )
      const notLearntMisspellings = misspellings.filter(m => {
        const word = wordSlice[m.index]
        return (
          learnedWords.indexOf(word) === -1 &&
          SpellingAPIManager.whitelist.indexOf(word) === -1
        )
      })
      return { misspellings: notLearntMisspellings }
    } else {
      return { misspellings }
    }
  }
}

SpellingAPIManager.runRequest = callbackify(promises.runRequest)
SpellingAPIManager.promises = promises

module.exports = SpellingAPIManager
