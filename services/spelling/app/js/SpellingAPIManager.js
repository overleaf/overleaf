// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SpellingAPIManager
const ASpell = require('./ASpell')
const LearnedWordsManager = require('./LearnedWordsManager')

module.exports = SpellingAPIManager = {
  whitelist: ['ShareLaTeX', 'sharelatex', 'LaTeX', 'http', 'https', 'www'],

  runRequest(token, request, callback) {
    if (callback == null) {
      callback = () => {}
    }
    if (request.words == null) {
      return callback(new Error('malformed JSON'))
    }

    const lang = request.language || 'en'

    const check = (words, callback) =>
      ASpell.checkWords(lang, words, (error, misspellings) =>
        callback(error, { misspellings })
      )
    const wordsToCheck = request.words || []

    if (token != null) {
      return LearnedWordsManager.getLearnedWords(token, function(
        error,
        learnedWords
      ) {
        if (error != null) {
          return callback(error)
        }
        const words = wordsToCheck.slice(0, 10000)
        return check(words, function(error, result) {
          if (error != null) {
            return callback(error)
          }
          result.misspellings = result.misspellings.filter(function(m) {
            const word = words[m.index]
            return (
              learnedWords.indexOf(word) === -1 &&
              SpellingAPIManager.whitelist.indexOf(word) === -1
            )
          })
          return callback(error, result)
        })
      })
    } else {
      return check(wordsToCheck, callback)
    }
  },

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
