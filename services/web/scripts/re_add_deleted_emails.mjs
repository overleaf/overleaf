// @ts-check

import minimist from 'minimist'
import { db, ObjectId } from '../app/src/infrastructure/mongodb.js'
import fs from 'node:fs/promises'
import * as csv from 'csv'
import { promisify } from 'node:util'
import { scriptRunner } from './lib/ScriptRunner.mjs'
import Errors from '../app/src/Features/Errors/Errors.js'
import UserGetter from '../app/src/Features/User/UserGetter.mjs'
import { READ_PREFERENCE_SECONDARY } from '@overleaf/mongo-utils/batchedUpdate.js'
import UserUpdater from '../app/src/Features/User/UserUpdater.mjs'
import EmailHelper from '../app/src/Features/Helpers/EmailHelper.js'
import AsyncLocalStorage from '../app/src/infrastructure/AsyncLocalStorage.js'
import AnalyticsManager from '../app/src/Features/Analytics/AnalyticsManager.mjs'
import UserAuditLogHandler from '../app/src/Features/User/UserAuditLogHandler.mjs'
import InstitutionsAPI from '../app/src/Features/Institutions/InstitutionsAPI.mjs'
import OError from '@overleaf/o-error'
import EmailChangeHelper from '../app/src/Features/Analytics/EmailChangeHelper.mjs'
import logger from '@overleaf/logger'

const CSV_FILENAME = '/tmp/re_add_deleted_emails.csv'

/**
 * @type {(csvString: string) => Promise<string[][]>}
 */
const parseAsync = promisify(csv.parse)

function usage() {
  console.log('Usage: node re_add_deleted_emails.mjs [options]')
  console.log(
    'fix wrongly removed emails by remove_unconfirmed_emails (see 2025-11-05 email removal)'
  )
  console.log(
    'run this script with a CSV containing user IDs and emails to re-add save in ',
    CSV_FILENAME
  )
  console.log('Options:')
  console.log('  --commit       apply the changes')
  process.exit(0)
}

const { commit, help } = minimist(process.argv.slice(2), {
  boolean: ['commit', 'help'],
  alias: { help: 'h' },
  default: { commit: false },
})

/**
 * @param {string} email
 */
async function isEmailUsed(email) {
  try {
    await UserGetter.promises.ensureUniqueEmailAddress(email)
    return false
  } catch (err) {
    if (err instanceof Errors.EmailExistsError) {
      return true
    }
    throw err
  }
}

async function consumeCsvFile(trackProgress) {
  console.time('re_add_deleted_emails')

  const csvContent = await fs.readFile(CSV_FILENAME, 'utf8')
  const rows = await parseAsync(csvContent)
  rows.shift() // Remove header row

  const emailsByUserId = {}
  for (const [userId, email] of rows) {
    if (!EmailHelper.parseEmail(email)) {
      throw new Error(`invalid email ${email}`)
    }

    if (!emailsByUserId[userId]) {
      emailsByUserId[userId] = []
    }
    emailsByUserId[userId].push(email)
  }

  const userIds = Object.keys(emailsByUserId)

  const counts = {
    /** @type {string[]} */
    processedUsers: [],
    /** @type {string[]} */
    userNotFound: [],
    /** @type {string[]} */
    emailsInUse: [],
    /** @type {string[]} */
    alreadyOk: [],
    /** @type {string[]} */
    primary: [],
    /** @type {string[]} */
    secondary: [],
    /** @type {string[]} */
    addedEmails: [],
  }

  console.log('Total emails in the CSV:', rows.length)
  console.log('Total users in the CSV:', userIds.length)

  for (const userId of userIds) {
    const candidateEmails = emailsByUserId[userId]

    const user = await db.users.findOne(
      { _id: new ObjectId(userId) },
      { readPreference: READ_PREFERENCE_SECONDARY }
    )
    if (!user) {
      counts.userNotFound.push(userId)
      continue
    }

    for (const email of candidateEmails) {
      if (user.emails.some(item => item.email === email)) {
        counts.alreadyOk.push(email)
        continue
      }

      const isUsed = await isEmailUsed(email)
      const isOwnPrimary = user.email === email

      if (isUsed && !isOwnPrimary) {
        counts.emailsInUse.push(email)
        continue
      }

      if (user.email === email) counts.primary.push(email)
      else counts.secondary.push(email)

      if (commit) {
        const auditLog = {
          initiatorId: null,
          ipAddress: null,
          info: {
            script: true,
            note: 'fix wrongly removed unconfirmed secondary email',
          },
        }
        if (isOwnPrimary) {
          // can't use addEmailAddress for primary email because ensureUniqueEmailAddress will throw
          // using an override instead
          await addEmailAddressOverride(user._id, email, {}, auditLog)
        } else {
          await UserUpdater.promises.addEmailAddress(
            user._id,
            email,
            {},
            auditLog
          )
        }
        await UserUpdater.promises.confirmEmail(user._id, email)
      }
      counts.addedEmails.push(email)
    }

    counts.processedUsers.push(userId)
    trackProgress(
      `Processed users: ${counts.processedUsers.length}/${userIds.length}`
    )
  }

  console.log()
  if (!commit) {
    console.log('Dry-run, use --commit to apply changes')
    console.log('This would be the result:')
    console.log()
  }

  console.log('Total emails in the CSV:', rows.length)
  console.log('Total users in the CSV:', userIds.length)
  console.log()
  console.log('Users not found:', counts.userNotFound.length)
  console.log('Users not found:', JSON.stringify(counts.userNotFound))
  console.log()
  console.log('Already OK:', counts.alreadyOk.length)
  console.log('Already OK:', JSON.stringify(counts.alreadyOk))
  console.log()
  console.log('Already in use:', counts.emailsInUse.length)
  console.log('Already in use:', JSON.stringify(counts.emailsInUse))
  console.log()
  console.log('Primary:', counts.primary.length)
  console.log('Primary:', JSON.stringify(counts.primary))
  console.log()
  console.log('Secondary:', counts.secondary.length)
  console.log('Secondary:', JSON.stringify(counts.secondary))
  console.log()
  console.log('Added emails:', counts.addedEmails.length)
  console.log('Added emails:', JSON.stringify(counts.addedEmails))
  console.log()
  console.log()
  console.timeEnd('re_add_deleted_emails')
  console.log()
}

async function main(trackProgress) {
  if (help) {
    return usage()
  }
  await consumeCsvFile(trackProgress)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}

async function addEmailAddressOverride(
  userId,
  newEmail,
  affiliationOptions,
  auditLog
) {
  AsyncLocalStorage.removeItem('userFullEmails')
  newEmail = EmailHelper.parseEmail(newEmail)
  if (!newEmail) {
    throw new Error('invalid email')
  }

  // Bypass ensureUniqueEmailAddress when re-adding primary emails
  // await UserGetter.promises.ensureUniqueEmailAddress(newEmail)

  AnalyticsManager.recordEventForUserInBackground(
    userId,
    'secondary-email-added'
  )

  await UserAuditLogHandler.promises.addEntry(
    userId,
    'add-email',
    auditLog.initiatorId,
    auditLog.ipAddress,
    {
      ...auditLog.info,
      newSecondaryEmail: newEmail,
    }
  )

  try {
    await InstitutionsAPI.promises.addAffiliation(
      userId,
      newEmail,
      affiliationOptions
    )
  } catch (error) {
    throw OError.tag(error, 'problem adding affiliation while adding email')
  }

  const createdAt = new Date()
  let res
  try {
    const reversedHostname = newEmail.split('@')[1].split('').reverse().join('')
    const update = {
      $push: {
        emails: { email: newEmail, createdAt, reversedHostname },
      },
    }
    res = await UserUpdater.promises.updateUser(
      { _id: userId, 'emails.email': { $ne: newEmail } },
      update
    )
  } catch (error) {
    throw OError.tag(error, 'problem updating users emails')
  }

  if (res.matchedCount !== 1) {
    return
  }

  try {
    await EmailChangeHelper.registerEmailCreation(userId, newEmail, {
      // @ts-expect-error - This is copied from UserUpdater.mjs
      createdAt: new Date(),
      emailCreatedAt: createdAt,
    })
  } catch (error) {
    logger.warn(
      { error, userId, newEmail },
      'Error registering email creation with analytics'
    )
  }
}
