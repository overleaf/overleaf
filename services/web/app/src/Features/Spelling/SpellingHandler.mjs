import OError from '@overleaf/o-error'
import Metrics from '@overleaf/metrics'
import { promisifyAll } from '@overleaf/promise-utils'
import LearnedWordsManager from './LearnedWordsManager.mjs'

const SpellingHandler = {
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

export default { ...SpellingHandler, promises: promisifyAll(SpellingHandler) }
