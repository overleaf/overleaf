const db = require('./DB')
const mongoCache = require('./MongoCache')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const { promisify } = require('util')

const LearnedWordsManager = {
  learnWord(userToken, word, callback) {
    if (callback == null) {
      callback = () => {}
    }
    mongoCache.del(userToken)
    return db.spellingPreferences.update(
      {
        token: userToken
      },
      {
        $push: { learnedWords: word }
      },
      {
        upsert: true
      },
      callback
    )
  },

  unlearnWord(userToken, word, callback) {
    if (callback == null) {
      callback = () => {}
    }
    mongoCache.del(userToken)
    return db.spellingPreferences.update(
      {
        token: userToken
      },
      {
        $pull: { learnedWords: word }
      },
      callback
    )
  },

  getLearnedWords(userToken, callback) {
    if (callback == null) {
      callback = () => {}
    }
    const mongoCachedWords = mongoCache.get(userToken)
    if (mongoCachedWords != null) {
      metrics.inc('mongoCache', 0.1, { status: 'hit' })
      return callback(null, mongoCachedWords)
    }

    metrics.inc('mongoCache', 0.1, { status: 'miss' })
    logger.info({ userToken }, 'mongoCache miss')

    db.spellingPreferences.findOne({ token: userToken }, function(
      error,
      preferences
    ) {
      if (error != null) {
        return callback(error)
      }
      const words =
        (preferences != null ? preferences.learnedWords : undefined) || []
      mongoCache.set(userToken, words)
      callback(null, words)
    })
  },

  deleteUsersLearnedWords(userToken, callback) {
    if (callback == null) {
      callback = () => {}
    }
    db.spellingPreferences.remove({ token: userToken }, callback)
  }
}

const promises = {
  learnWord: promisify(LearnedWordsManager.learnWord),
  unlearnWord: promisify(LearnedWordsManager.unlearnWord),
  getLearnedWords: promisify(LearnedWordsManager.getLearnedWords),
  deleteUsersLearnedWords: promisify(
    LearnedWordsManager.deleteUsersLearnedWords
  )
}

LearnedWordsManager.promises = promises

module.exports = LearnedWordsManager
;['learnWord', 'unlearnWord', 'getLearnedWords'].map(method =>
  metrics.timeAsyncMethod(
    LearnedWordsManager,
    method,
    'mongo.LearnedWordsManager',
    logger
  )
)
