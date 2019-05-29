/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserController
const UserGetter = require('./UserGetter')
const logger = require('logger-sharelatex')
const UserDeleter = require('./UserDeleter')
const UserUpdater = require('./UserUpdater')
const sanitize = require('sanitizer')
const AuthenticationController = require('../Authentication/AuthenticationController')
const { ObjectId } = require('mongojs')

module.exports = UserController = {
  getLoggedInUsersPersonalInfo(req, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log(
      { user_id },
      'reciving request for getting logged in users personal info'
    )
    if (user_id == null) {
      return next(new Error('User is not logged in'))
    }
    return UserGetter.getUser(
      user_id,
      {
        first_name: true,
        last_name: true,
        role: true,
        institution: true,
        email: true,
        signUpDate: true
      },
      function(error, user) {
        if (error != null) {
          return next(error)
        }
        return UserController.sendFormattedPersonalInfo(user, res, next)
      }
    )
  },

  getPersonalInfo(req, res, next) {
    let query
    if (next == null) {
      next = function(error) {}
    }
    const { user_id } = req.params

    if (/^\d+$/.test(user_id)) {
      query = { 'overleaf.id': parseInt(user_id, 10) }
    } else if (/^[a-f0-9]{24}$/.test(user_id)) {
      query = { _id: ObjectId(user_id) }
    } else {
      return res.send(400)
    }

    return UserGetter.getUser(
      query,
      { _id: true, first_name: true, last_name: true, email: true },
      function(error, user) {
        logger.log(
          { user_id: req.params.user_id },
          'receiving request for getting users personal info'
        )
        if (error != null) {
          return next(error)
        }
        if (user == null) {
          return res.send(404)
        }
        return UserController.sendFormattedPersonalInfo(user, res, next)
      }
    )
  },

  sendFormattedPersonalInfo(user, res, next) {
    if (next == null) {
      next = function(error) {}
    }
    const info = UserController.formatPersonalInfo(user)
    return res.json(info)
  },

  formatPersonalInfo(user, callback) {
    if (callback == null) {
      callback = function(error, info) {}
    }
    if (user == null) {
      return {}
    }
    const formatted_user = { id: user._id.toString() }
    for (let key of [
      'first_name',
      'last_name',
      'email',
      'signUpDate',
      'role',
      'institution'
    ]) {
      if (user[key] != null) {
        formatted_user[key] = user[key]
      }
    }
    return formatted_user
  }
}
