/* eslint-disable
    max-len,
    no-unused-vars,
    no-use-before-define,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SudoModeController
const logger = require('logger-sharelatex')
const SudoModeHandler = require('./SudoModeHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const { ObjectId } = require('../../infrastructure/Mongoose').mongo
const UserGetter = require('../User/UserGetter')
const Settings = require('settings-sharelatex')

module.exports = SudoModeController = {
  sudoModePrompt(req, res, next) {
    if (req.externalAuthenticationSystemUsed() && Settings.overleaf == null) {
      logger.log({ userId }, '[SudoMode] using external auth, redirecting')
      return res.redirect('/project')
    }
    var userId = AuthenticationController.getLoggedInUserId(req)
    logger.log({ userId }, '[SudoMode] rendering sudo mode password page')
    return SudoModeHandler.isSudoModeActive(userId, function(err, isActive) {
      if (err != null) {
        logger.warn(
          { err, userId },
          '[SudoMode] error checking if sudo mode is active'
        )
        return next(err)
      }
      if (isActive) {
        logger.log(
          { userId },
          '[SudoMode] sudo mode already active, redirecting'
        )
        return res.redirect('/project')
      }
      return res.render('sudo_mode/sudo_mode_prompt', {
        title: 'confirm_password_to_continue'
      })
    })
  },

  submitPassword(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    const redir =
      AuthenticationController._getRedirectFromSession(req) || '/project'
    const { password } = req.body
    if (!password) {
      logger.log(
        { userId },
        '[SudoMode] no password supplied, failed authentication'
      )
      return next(new Error('no password supplied'))
    }
    logger.log({ userId, redir }, '[SudoMode] checking user password')
    return UserGetter.getUser(ObjectId(userId), { email: 1 }, function(
      err,
      userRecord
    ) {
      if (err != null) {
        logger.warn({ err, userId }, '[SudoMode] error getting user')
        return next(err)
      }
      if (userRecord == null) {
        err = new Error('user not found')
        logger.warn({ err, userId }, '[SudoMode] user not found')
        return next(err)
      }
      return SudoModeHandler.authenticate(userRecord.email, password, function(
        err,
        user
      ) {
        if (err != null) {
          logger.warn({ err, userId }, '[SudoMode] error authenticating user')
          return next(err)
        }
        if (user != null) {
          logger.log(
            { userId },
            '[SudoMode] authenticated user, activating sudo mode'
          )
          return SudoModeHandler.activateSudoMode(userId, function(err) {
            if (err != null) {
              logger.warn(
                { err, userId },
                '[SudoMode] error activating sudo mode'
              )
              return next(err)
            }
            return res.json({
              redir
            })
          })
        } else {
          logger.log({ userId }, '[SudoMode] authentication failed for user')
          return res.json({
            message: {
              text: req.i18n.translate('invalid_password'),
              type: 'error'
            }
          })
        }
      })
    })
  }
}
