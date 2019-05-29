/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserCreator
const { User } = require('../../models/User')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const { addAffiliation } = require('../Institutions/InstitutionsAPI')

module.exports = UserCreator = {
  createNewUser(attributes, options, callback) {
    if (callback == null) {
      callback = function(error, user) {}
    }
    if (arguments.length === 2) {
      callback = options
      options = {}
    }
    logger.log({ user: attributes }, 'creating new user')
    const user = new User()

    const username = attributes.email.match(/^[^@]*/)
    if (attributes.first_name == null || attributes.first_name === '') {
      attributes.first_name = username[0]
    }

    for (let key in attributes) {
      const value = attributes[key]
      user[key] = value
    }

    user.ace.syntaxValidation = true
    if (user.featureSwitches != null) {
      user.featureSwitches.pdfng = true
    }
    user.emails = [
      {
        email: user.email,
        createdAt: new Date(),
        reversedHostname: user.email
          .split('@')[1]
          .split('')
          .reverse()
          .join('')
      }
    ]

    return user.save(function(err) {
      callback(err, user)

      if (options != null ? options.skip_affiliation : undefined) {
        return
      }
      // call addaffiliation after the main callback so it runs in the
      // background. There is no guaranty this will run so we must no rely on it
      return addAffiliation(user._id, user.email, function(error) {
        if (error) {
          return logger.log(
            { userId: user._id, email: user.email, error },
            "couldn't add affiliation for user on create"
          )
        } else {
          return logger.log(
            { userId: user._id, email: user.email },
            'added affiliation for user on create'
          )
        }
      })
    })
  }
}

metrics.timeAsyncMethod(
  UserCreator,
  'createNewUser',
  'mongo.UserCreator',
  logger
)
