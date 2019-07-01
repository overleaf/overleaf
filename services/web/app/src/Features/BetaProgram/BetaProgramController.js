/* eslint-disable
    camelcase,
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
let BetaProgramController
const BetaProgramHandler = require('./BetaProgramHandler')
const UserGetter = require('../User/UserGetter')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = BetaProgramController = {
  optIn(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log({ user_id }, 'user opting in to beta program')
    if (user_id == null) {
      return next(new Error('no user id in session'))
    }
    return BetaProgramHandler.optIn(user_id, function(err) {
      if (err) {
        return next(err)
      }
      return res.redirect('/beta/participate')
    })
  },

  optOut(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log({ user_id }, 'user opting out of beta program')
    if (user_id == null) {
      return next(new Error('no user id in session'))
    }
    return BetaProgramHandler.optOut(user_id, function(err) {
      if (err) {
        return next(err)
      }
      return res.redirect('/beta/participate')
    })
  },

  optInPage(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    logger.log({ user_id }, 'showing beta participation page for user')
    return UserGetter.getUser(user_id, function(err, user) {
      if (err) {
        logger.warn({ err, user_id }, 'error fetching user')
        return next(err)
      }
      return res.render('beta_program/opt_in', {
        title: 'sharelatex_beta_program',
        user,
        languages: Settings.languages
      })
    })
  }
}
