const _ = require('lodash')
const { ObjectId, waitForDb } = require('../../infrastructure/mongodb')
const async = require('async')
const logger = require('logger-sharelatex')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const InstitutionsAPI = require('./InstitutionsAPI')

const ASYNC_LIMIT = 10

const processLapsedLogger = {
  refreshedUsers: [],
  failedToRefresh: [],
  printSummary: () => {
    logger.log(
      `Reconfirmations lapsed processed. ${processLapsedLogger.refreshedUsers.length} successfull and ${processLapsedLogger.failedToRefresh.length} failed.`,
      {
        refreshedUsers: processLapsedLogger.refreshedUsers,
        failedToRefresh: processLapsedLogger.failedToRefresh,
      }
    )
  },
}

function _validateUserIdList(userIds) {
  if (!Array.isArray(userIds)) throw new Error('users is not an array')

  userIds.forEach(userId => {
    if (!ObjectId.isValid(userId)) throw new Error('user ID not valid')
  })
}

function _refreshUser(userId, callback) {
  FeaturesUpdater.refreshFeatures(userId, error => {
    if (error) {
      logger.warn(`Failed to refresh features for ${userId}`, error)
      processLapsedLogger.failedToRefresh.push(userId)
    } else {
      processLapsedLogger.refreshedUsers.push(userId)
    }
    return callback()
  })
}

async function _loopRefreshUsers(userIds) {
  await new Promise((resolve, reject) => {
    async.eachLimit(userIds, ASYNC_LIMIT, _refreshUser, error => {
      if (error) return reject(error)
      resolve()
    })
  })
}

async function processLapsed() {
  logger.log('Begin processing lapsed reconfirmations')
  await waitForDb()

  const result = await InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed()
  const userIds = _.get(result, ['data', 'users'])

  _validateUserIdList(userIds)
  logger.log(
    `Starting to process ${userIds.length} users with lapsed reconfirmations`
  )
  await _loopRefreshUsers(userIds)

  processLapsedLogger.printSummary()

  try {
    logger.log('Updating reconfirmations lapsed processed dates')
    await InstitutionsAPI.promises.sendUsersWithReconfirmationsLapsedProcessed(
      processLapsedLogger.refreshedUsers
    )
  } catch (error) {
    logger.log('Error updating features_refreshed_at', error)
  }

  logger.log('Done processing lapsed reconfirmations')

  return {
    refreshedUsers: processLapsedLogger.refreshedUsers,
    failedToRefresh: processLapsedLogger.failedToRefresh,
  }
}

const InstitutionsReconfirmationHandler = {
  processLapsed,
}

module.exports = InstitutionsReconfirmationHandler
