const BetaProgramHandler = require('./BetaProgramHandler')
const OError = require('@overleaf/o-error')
const UserGetter = require('../User/UserGetter')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const SessionManager = require('../Authentication/SessionManager')

const BetaProgramController = {
  optIn(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    logger.debug({ userId }, 'user opting in to beta program')
    if (userId == null) {
      return next(new Error('no user id in session'))
    }
    BetaProgramHandler.optIn(userId, function (err) {
      if (err) {
        return next(err)
      }
      res.redirect('/beta/participate')
    })
  },

  optOut(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    logger.debug({ userId }, 'user opting out of beta program')
    if (userId == null) {
      return next(new Error('no user id in session'))
    }
    BetaProgramHandler.optOut(userId, function (err) {
      if (err) {
        return next(err)
      }
      res.redirect('/beta/participate')
    })
  },

  optInPage(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    logger.debug({ userId }, 'showing beta participation page for user')
    UserGetter.getUser(userId, function (err, user) {
      if (err) {
        OError.tag(err, 'error fetching user', {
          userId,
        })
        return next(err)
      }
      res.render('beta_program/opt_in', {
        title: 'sharelatex_beta_program',
        user,
        languages: Settings.languages,
      })
    })
  },
}

module.exports = BetaProgramController
