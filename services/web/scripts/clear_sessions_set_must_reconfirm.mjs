import fs from 'node:fs'
import { ObjectId } from '../app/src/infrastructure/mongodb.js'
import UserUpdater from '../app/src/Features/User/UserUpdater.js'
import UserSessionsManager from '../app/src/Features/User/UserSessionsManager.js'
import UserAuditLogHandler from '../app/src/Features/User/UserAuditLogHandler.js'
import { promiseMapWithLimit } from '@overleaf/promise-utils'

const ASYNC_LIMIT = 10

const processLogger = {
  failedClear: [],
  failedSet: [],
  success: [],
  printSummary: () => {
    console.log(
      {
        success: processLogger.success,
        failedClear: processLogger.failedClear,
        failedSet: processLogger.failedSet,
      },
      `\nDONE. ${processLogger.success.length} successful. ${processLogger.failedClear.length} failed to clear sessions. ${processLogger.failedSet.length} failed to set must_reconfirm.`
    )
  },
}

function _validateUserIdList(userIds) {
  if (!Array.isArray(userIds)) throw new Error('users is not an array')

  userIds.forEach(userId => {
    if (!ObjectId.isValid(userId)) throw new Error('user ID not valid')
  })
}

async function _handleUser(userId) {
  try {
    await UserUpdater.promises.updateUser(userId, {
      $set: { must_reconfirm: true },
    })
  } catch (error) {
    console.log(`Failed to set must_reconfirm ${userId}`, error)
    processLogger.failedSet.push(userId)
    return
  }

  try {
    await UserAuditLogHandler.promises.addEntry(
      userId,
      'must-reset-password-set',
      undefined,
      undefined,
      { script: true }
    )
  } catch (error) {
    console.log(`Failed to create audit log for ${userId}`, error)
    // don't block the process if audit log fails
  }

  try {
    await UserSessionsManager.promises.removeSessionsFromRedis(
      { _id: userId },
      null
    )
  } catch (error) {
    console.log(`Failed to clear sessions for ${userId}`, error)
    processLogger.failedClear.push(userId)
    return
  }
  processLogger.success.push(userId)
}

async function _loopUsers(userIds) {
  return promiseMapWithLimit(ASYNC_LIMIT, userIds, _handleUser)
}

const fileName = process.argv[2]
if (!fileName) throw new Error('missing filename')
const usersFile = fs.readFileSync(fileName, 'utf8')
const userIds = usersFile
  .trim()
  .split('\n')
  .map(id => id.trim())

async function processUsers(userIds) {
  console.log('---Starting set_must_reconfirm script---')
  _validateUserIdList(userIds)
  console.log(`---Starting to process ${userIds.length} users---`)
  await _loopUsers(userIds)

  processLogger.printSummary()
  process.exit()
}

processUsers(userIds)
