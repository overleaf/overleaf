const request = require('request')
const requestRetry = require('requestretry')
const Settings = require('@overleaf/settings')
const OError = require('@overleaf/o-error')
const Metrics = require('@overleaf/metrics')

const TIMEOUT = 10 * 1000

module.exports = {
  getUserDictionaryWithRetries(userId, callback) {
    const timer = new Metrics.Timer('spelling_get_dict')
    const options = {
      url: `${Settings.apis.spelling.url}/user/${userId}`,
      timeout: 3 * 1000,
      json: true,
      retryDelay: 1,
      maxAttempts: 3,
    }
    requestRetry(options, (error, response, body) => {
      if (error) {
        return callback(
          OError.tag(error, 'error getting user dictionary', { error, userId })
        )
      }

      if (response.statusCode !== 200) {
        return callback(
          new OError(
            'Non-success code from spelling API when getting user dictionary',
            { userId, statusCode: response.statusCode }
          )
        )
      }

      timer.done()
      callback(null, body)
    })
  },

  getUserDictionary(userId, callback) {
    const url = `${Settings.apis.spelling.url}/user/${userId}`
    request.get({ url: url, timeout: TIMEOUT }, (error, response) => {
      if (error) {
        return callback(
          OError.tag(error, 'error getting user dictionary', { error, userId })
        )
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return callback(
          new OError(
            'Non-success code from spelling API when getting user dictionary',
            { userId, statusCode: response.statusCode }
          )
        )
      }

      callback(null, JSON.parse(response.body))
    })
  },

  deleteWordFromUserDictionary(userId, word, callback) {
    const url = `${Settings.apis.spelling.url}/user/${userId}/unlearn`
    request.post(
      {
        url: url,
        json: {
          word,
        },
        timeout: TIMEOUT,
      },
      (error, response) => {
        if (error) {
          return callback(
            OError.tag(error, 'error deleting word from user dictionary', {
              userId,
              word,
            })
          )
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          return callback(
            new OError(
              'Non-success code from spelling API when removing word from user dictionary',
              { userId, word, statusCode: response.statusCode }
            )
          )
        }

        callback()
      }
    )
  },

  deleteUserDictionary(userId, callback) {
    const url = `${Settings.apis.spelling.url}/user/${userId}`
    request.delete({ url: url, timeout: TIMEOUT }, (error, response) => {
      if (error) {
        return callback(
          OError.tag(error, 'error deleting user dictionary', { userId })
        )
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return callback(
          new OError(
            'Non-success code from spelling API when removing user dictionary',
            { userId, statusCode: response.statusCode }
          )
        )
      }

      callback()
    })
  },
}
