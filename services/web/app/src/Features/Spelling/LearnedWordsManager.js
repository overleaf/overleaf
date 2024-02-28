const { db } = require('../../infrastructure/mongodb')
const { promisify } = require('util')
const OError = require('@overleaf/o-error')
const Settings = require('@overleaf/settings')
const { InvalidError } = require('../Errors/Errors')

const LearnedWordsManager = {
  learnWord(userToken, word, callback) {
    LearnedWordsManager.getLearnedWordsSize(userToken, (error, wordsSize) => {
      if (error != null) {
        return callback(OError.tag(error))
      }
      const wordSize = Buffer.from(word).length
      if (wordsSize + wordSize > Settings.maxDictionarySize) {
        return callback(new InvalidError('Max dictionary size reached'))
      }
      db.spellingPreferences.updateOne(
        {
          token: userToken,
        },
        {
          $addToSet: { learnedWords: word },
        },
        {
          upsert: true,
        },
        callback
      )
    })
  },

  unlearnWord(userToken, word, callback) {
    return db.spellingPreferences.updateOne(
      {
        token: userToken,
      },
      {
        $pull: { learnedWords: word },
      },
      callback
    )
  },

  getLearnedWords(userToken, callback) {
    db.spellingPreferences.findOne(
      { token: userToken },
      function (error, preferences) {
        if (error != null) {
          return callback(OError.tag(error))
        }
        let words =
          (preferences != null ? preferences.learnedWords : undefined) || []
        if (words) {
          // remove duplicates
          words = words.filter(
            (value, index, self) => self.indexOf(value) === index
          )
        }
        callback(null, words)
      }
    )
  },

  getLearnedWordsSize(userToken, callback) {
    db.spellingPreferences.findOne(
      { token: userToken },
      function (error, preferences) {
        if (error != null) {
          return callback(OError.tag(error))
        }
        const words = (preferences && preferences.learnedWords) || []
        const wordsSize = Buffer.from(JSON.stringify(words)).length
        callback(null, wordsSize)
      }
    )
  },

  deleteUsersLearnedWords(userToken, callback) {
    db.spellingPreferences.deleteOne({ token: userToken }, callback)
  },
}

const promises = {
  learnWord: promisify(LearnedWordsManager.learnWord),
  unlearnWord: promisify(LearnedWordsManager.unlearnWord),
  getLearnedWords: promisify(LearnedWordsManager.getLearnedWords),
  deleteUsersLearnedWords: promisify(
    LearnedWordsManager.deleteUsersLearnedWords
  ),
}

LearnedWordsManager.promises = promises

module.exports = LearnedWordsManager
