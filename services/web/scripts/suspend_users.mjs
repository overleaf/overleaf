/*
 * Read a list of user IDs from a file and suspend their accounts.
 *
 * Usage: node scripts/suspend_users.mjs <filename>
 */
import fs from 'node:fs'
import { ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import UserUpdater from '../app/src/Features/User/UserUpdater.mjs'
import { promiseMapWithLimit } from '@overleaf/promise-utils'

const ASYNC_LIMIT = 10

const processLogger = {
  failed: [],
  success: [],
  printSummary: () => {
    console.log(
      {
        success: processLogger.success,
        failed: processLogger.failed,
      },
      `\nDONE. ${processLogger.success.length} successful. ${processLogger.failed.length} failed to suspend.`
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
    await UserUpdater.promises.suspendUser(userId, {
      ip: '0.0.0.0',
      info: { script: true },
    })
  } catch (error) {
    console.log(`Failed to suspend ${userId}`, error)
    processLogger.failed.push(userId)
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
  console.log('---Starting suspend_users script---')
  _validateUserIdList(userIds)
  console.log(`---Starting to process ${userIds.length} users---`)
  await _loopUsers(userIds)

  processLogger.printSummary()
  process.exit()
}

processUsers(userIds)
