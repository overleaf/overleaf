const OError = require('@overleaf/o-error')
const Metrics = require('@overleaf/metrics')
const { promisifyAll } = require('@overleaf/promise-utils')
const LearnedWordsManager = require('./LearnedWordsManager')

module.exports = {
  getUserDictionary(userId, callback) {
    const timer = new Metrics.Timer('spelling_get_dict')
    LearnedWordsManager.getLearnedWords(userId, (error, words) => {
      if (error) {
        return callback(
          OError.tag(error, 'error getting user dictionary', { error, userId })
        )
      }
      timer.done()
      callback(null, words)
    })
  },

  deleteWordFromUserDictionary(userId, word, callback) {
    LearnedWordsManager.unlearnWord(userId, word, callback)
  },

  deleteUserDictionary(userId, callback) {
    LearnedWordsManager.deleteUsersLearnedWords(userId, callback)
  },
}

module.exports.promises = promisifyAll(module.exports)
