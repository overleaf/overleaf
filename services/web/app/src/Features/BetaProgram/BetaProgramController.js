const BetaProgramHandler = require('./BetaProgramHandler')
const OError = require('@overleaf/o-error')
const UserGetter = require('../User/UserGetter')
const logger = require('@overleaf/logger')
const SessionManager = require('../Authentication/SessionManager')
const SplitTestSessionHandler = require('../SplitTests/SplitTestSessionHandler')
const { expressify } = require('@overleaf/promise-utils')

async function optIn(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  await BetaProgramHandler.promises.optIn(userId)
  try {
    await SplitTestSessionHandler.promises.sessionMaintenance(req, null)
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to perform session maintenance after beta program opt in'
    )
  }
  res.redirect('/beta/participate')
}

async function optOut(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  await BetaProgramHandler.promises.optOut(userId)
  try {
    await SplitTestSessionHandler.promises.sessionMaintenance(req, null)
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to perform session maintenance after beta program opt out'
    )
  }
  res.redirect('/beta/participate')
}

async function optInPage(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  let user
  try {
    user = await UserGetter.promises.getUser(userId, { betaProgram: 1 })
  } catch (error) {
    throw OError.tag(error, 'error fetching user', {
      userId,
    })
  }
  res.render('beta_program/opt_in', {
    title: 'sharelatex_beta_program',
    user,
  })
}

module.exports = {
  optIn: expressify(optIn),
  optOut: expressify(optOut),
  optInPage: expressify(optInPage),
}
