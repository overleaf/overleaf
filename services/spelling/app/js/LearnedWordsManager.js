// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LearnedWordsManager
const db = require('./DB')
const mongoCache = require('./MongoCache')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')

module.exports = LearnedWordsManager = {
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

    return db.spellingPreferences.findOne({ token: userToken }, function(
      error,
      preferences
    ) {
      if (error != null) {
        return callback(error)
      }
      const words =
        (preferences != null ? preferences.learnedWords : undefined) || []
      mongoCache.set(userToken, words)
      return callback(null, words)
    })
  },

  deleteUsersLearnedWords(userToken, callback) {
    if (callback == null) {
      callback = () => {}
    }
    return db.spellingPreferences.remove({ token: userToken }, callback)
  }
}
;['learnWord', 'getLearnedWords'].map(method =>
  metrics.timeAsyncMethod(
    LearnedWordsManager,
    method,
    'mongo.LearnedWordsManager',
    logger
  )
)
