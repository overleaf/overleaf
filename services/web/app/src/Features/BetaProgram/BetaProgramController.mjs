import BetaProgramHandler from './BetaProgramHandler.mjs'
import OError from '@overleaf/o-error'
import UserGetter from '../User/UserGetter.js'
import logger from '@overleaf/logger'
import SessionManager from '../Authentication/SessionManager.js'
import SplitTestSessionHandler from '../SplitTests/SplitTestSessionHandler.js'
import { expressify } from '@overleaf/promise-utils'

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

export default {
  optIn: expressify(optIn),
  optOut: expressify(optOut),
  optInPage: expressify(optInPage),
}
