import fs from 'fs'
import { ObjectId, waitForDb } from '../app/src/infrastructure/mongodb.js'
import async from 'async'
import UserUpdater from '../app/src/Features/User/UserUpdater.js'
import UserSessionsManager from '../app/src/Features/User/UserSessionsManager.js'

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

function _handleUser(userId, callback) {
  UserUpdater.updateUser(userId, { $set: { must_reconfirm: true } }, error => {
    if (error) {
      console.log(`Failed to set must_reconfirm ${userId}`, error)
      processLogger.failedSet.push(userId)
      return callback()
    } else {
      UserSessionsManager.removeSessionsFromRedis(
        { _id: userId },
        null,
        error => {
          if (error) {
            console.log(`Failed to clear sessions for ${userId}`, error)
            processLogger.failedClear.push(userId)
          } else {
            processLogger.success.push(userId)
          }
          return callback()
        }
      )
    }
  })
}

async function _loopUsers(userIds) {
  await new Promise((resolve, reject) => {
    async.eachLimit(userIds, ASYNC_LIMIT, _handleUser, error => {
      if (error) return reject(error)
      resolve()
    })
  })
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
  await waitForDb()

  _validateUserIdList(userIds)
  console.log(`---Starting to process ${userIds.length} users---`)
  await _loopUsers(userIds)

  processLogger.printSummary()
  process.exit()
}

processUsers(userIds)
