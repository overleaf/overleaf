// @ts-check

import { db, ObjectId } from '../app/src/infrastructure/mongodb.js'
import fs from 'node:fs/promises'
import * as csv from 'csv'
import { promisify } from 'node:util'
import { scriptRunner } from './lib/ScriptRunner.mjs'
import { READ_PREFERENCE_SECONDARY } from '@overleaf/mongo-utils/batchedUpdate.js'

const CSV_FILENAME = '/tmp/unconfirmed_emails.csv'

/**
 * @type {(csvString: string) => Promise<string[][]>}
 */
const parseAsync = promisify(csv.parse)

/**
 * Checks the fallout of services/web/scripts/remove_unconfirmed_emails.mjs
 * which wrongly removed some emails that have been confirmed by users
 */
async function main(trackProgress) {
  console.time('check_removed_emails')

  const csvContent = await fs.readFile(CSV_FILENAME, 'utf8')
  const rows = await parseAsync(csvContent)
  rows.shift() // Remove header row
  const emailsByUserId = {}

  for (const [userId, email] of rows) {
    if (!emailsByUserId[userId]) {
      emailsByUserId[userId] = []
    }
    emailsByUserId[userId].push(email)
  }

  const userIds = Object.keys(emailsByUserId)
  let processedUsersCount = 0

  const counts = {
    /** @type {string[]} */
    userNotFound: [],
    /** @type {string[]} */
    notDeleted: [],
    deleted: 0,
    /** @type {string[]} */
    wasConfirmed: [],
    /** @type {string[]} */
    wasConfirmedLegacy: [],
    /** @type {string[]} */
    madePrimary: [],
    /** @type {string[]} */
    madeSecondary: [],
    /** @type {string[]} */
    isPrimary: [],
    /** @type {string[]} */
    isAddedAgain: [],
  }

  console.log('Total emails in the CSV:', rows.length)
  console.log('Total users in the CSV:', userIds.length)

  for (const userId of userIds) {
    const userEmails = emailsByUserId[userId]

    const user = await db.users.findOne(
      { _id: new ObjectId(userId) },
      { readPreference: READ_PREFERENCE_SECONDARY }
    )

    if (!user) {
      counts.userNotFound.push(userId)
      continue
    }

    for (const email of userEmails) {
      const deletionLog = await db.userAuditLogEntries.findOne(
        {
          userId: new ObjectId(userId),
          operation: 'remove-email',
          'info.removedEmail': email,
          'info.note': 'remove unconfirmed secondary emails',
        },
        { readPreference: READ_PREFERENCE_SECONDARY }
      )
      if (!deletionLog) {
        counts.notDeleted.push(email)
        continue
      }
      counts.deleted++

      if (user.email === email) {
        counts.isPrimary.push(email)
      }

      const confirmationLog = await db.userAuditLogEntries.findOne(
        {
          userId: new ObjectId(userId),
          operation: 'confirm-email-via-code',
          'info.email': email,
          timestamp: { $gt: new Date('2025-02-25') },
        },
        { readPreference: READ_PREFERENCE_SECONDARY }
      )
      if (confirmationLog) {
        counts.wasConfirmed.push(email)
      }

      const confirmationLegacyLog = await db.userAuditLogEntries.findOne(
        {
          userId: new ObjectId(userId),
          operation: 'confirm-email',
          'info.email': email,
          timestamp: { $gt: new Date('2025-02-25') },
        },
        { readPreference: READ_PREFERENCE_SECONDARY }
      )
      if (confirmationLegacyLog) {
        counts.wasConfirmedLegacy.push(email)
      }

      const madePrimaryLog = await db.userAuditLogEntries.findOne(
        {
          userId: new ObjectId(userId),
          operation: 'change-primary-email',
          'info.newPrimaryEmail': email,
          timestamp: { $gt: new Date('2025-02-25') },
        },
        { readPreference: READ_PREFERENCE_SECONDARY }
      )
      if (madePrimaryLog) {
        counts.madePrimary.push(email)
      }

      const madeSecondaryLog = await db.userAuditLogEntries.findOne(
        {
          userId: new ObjectId(userId),
          operation: 'change-primary-email',
          'info.oldPrimaryEmail': email,
          timestamp: { $gt: new Date('2025-02-25') },
        },
        { readPreference: READ_PREFERENCE_SECONDARY }
      )
      if (madeSecondaryLog) {
        counts.madeSecondary.push(email)
      }

      if (user.emails.some(item => item.email === email)) {
        counts.isAddedAgain.push(email)
      }
    }

    processedUsersCount++
    if (processedUsersCount % 100 === 0) {
      trackProgress(`Processed ${processedUsersCount} users`)
    }
  }

  console.log()
  console.log('Total emails in the CSV:', rows.length)
  console.log('Total users in the CSV:', userIds.length)
  console.log('Total users processed:', processedUsersCount)
  console.log()
  console.log('Users not found:', JSON.stringify(counts.userNotFound))
  console.log()
  console.log('Emails not deleted:', counts.notDeleted.length)
  console.log('Emails deleted:', counts.deleted)
  console.log()
  console.log('Emails that were confirmed:', counts.wasConfirmed.length)
  console.log(
    'Emails that were confirmed:',
    JSON.stringify(counts.wasConfirmed)
  )
  console.log()
  console.log(
    'Emails that were confirmed (legacy):',
    counts.wasConfirmedLegacy.length
  )
  console.log(
    'Emails that were confirmed (legacy):',
    JSON.stringify(counts.wasConfirmedLegacy)
  )
  console.log()
  console.log('Emails that are primary:', counts.isPrimary.length)
  console.log('Emails that are primary:', JSON.stringify(counts.isPrimary))
  console.log()
  console.log('Emails that were made primary:', counts.madePrimary.length)
  console.log(
    'Emails that were made primary:',
    JSON.stringify(counts.madePrimary)
  )
  console.log()
  console.log('Emails that were made secondary:', counts.madeSecondary.length)
  console.log(
    'Emails that were made secondary:',
    JSON.stringify(counts.madeSecondary)
  )
  console.log()
  console.log('Emails that were added again:', counts.isAddedAgain.length)
  console.log(
    'Emails that were added again:',
    JSON.stringify(counts.isAddedAgain)
  )
  console.log()
  console.timeEnd('check_removed_emails')
  console.log()
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
