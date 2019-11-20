const request = require('request')
const Settings = require('settings-sharelatex')
const OError = require('@overleaf/o-error')

const TIMEOUT = 10 * 1000

module.exports = {
  getUserDictionary(userId, callback) {
    const url = `${Settings.apis.spelling.url}/user/${userId}`
    request.get({ url: url, timeout: TIMEOUT }, (error, response) => {
      if (error) {
        return callback(
          new OError({
            message: 'error getting user dictionary',
            info: { error, userId }
          }).withCause(error)
        )
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return callback(
          new OError({
            message:
              'Non-success code from spelling API when getting user dictionary',
            info: { userId, statusCode: response.statusCode }
          })
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
          word
        },
        timeout: TIMEOUT
      },
      (error, response) => {
        if (error) {
          return callback(
            new OError({
              message: 'error deleting word from user dictionary',
              info: { error, userId, word }
            }).withCause(error)
          )
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          return callback(
            new OError({
              message:
                'Non-success code from spelling API when removing word from user dictionary',
              info: { userId, word, statusCode: response.statusCode }
            })
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
          new OError({
            message: 'error deleting user dictionary',
            info: { userId }
          }).withCause(error)
        )
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return callback(
          new OError({
            message:
              'Non-success code from spelling API when removing user dictionary',
            info: { userId, statusCode: response.statusCode }
          })
        )
      }

      callback()
    })
  }
}
