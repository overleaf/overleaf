import mongodb from '../../infrastructure/mongodb.mjs'
import { callbackify } from 'node:util'
import Settings from '@overleaf/settings'
import Errors from '../Errors/Errors.js'

const { db } = mongodb

const LearnedWordsManager = {
  /**
   * @param {string} userToken
   * @param {string} word
   */
  async learnWord(userToken, word) {
    const wordsSize = await LearnedWordsManager.getLearnedWordsSize(userToken)

    const wordSize = Buffer.from(word).length
    if (wordsSize + wordSize > Settings.maxDictionarySize) {
      throw new Errors.InvalidError('Max dictionary size reached')
    }

    return await db.spellingPreferences.updateOne(
      {
        token: userToken,
      },
      {
        $addToSet: { learnedWords: word },
      },
      {
        upsert: true,
      }
    )
  },

  /**
   * @param {string} userToken
   * @param {string} word
   */
  async unlearnWord(userToken, word) {
    return await db.spellingPreferences.updateOne(
      {
        token: userToken,
      },
      {
        $pull: { learnedWords: word },
      }
    )
  },

  /**
   * @param {string} userToken
   */
  async getLearnedWords(userToken) {
    const preferences = await db.spellingPreferences.findOne({
      token: userToken,
    })

    let words =
      (preferences != null ? preferences.learnedWords : undefined) || []

    if (words) {
      // remove duplicates
      words = words.filter(
        (value, index, self) => self.indexOf(value) === index
      )
    }
    return words
  },

  /**
   * @param {string} userToken
   */
  async getLearnedWordsSize(userToken) {
    const preferences = await db.spellingPreferences.findOne({
      token: userToken,
    })

    const words = (preferences && preferences.learnedWords) || []
    return Buffer.from(JSON.stringify(words)).length
  },

  /**
   * @param {string} userToken
   */
  async deleteUsersLearnedWords(userToken) {
    return await db.spellingPreferences.deleteOne({ token: userToken })
  },
}

export default {
  learnWord: callbackify(LearnedWordsManager.learnWord),
  unlearnWord: callbackify(LearnedWordsManager.unlearnWord),
  getLearnedWords: callbackify(LearnedWordsManager.getLearnedWords),
  getLearnedWordsSize: callbackify(LearnedWordsManager.getLearnedWordsSize),
  deleteUsersLearnedWords: callbackify(
    LearnedWordsManager.deleteUsersLearnedWords
  ),
  promises: LearnedWordsManager,
}
