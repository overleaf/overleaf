// @ts-check

import minimist from 'minimist'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import { db, ObjectId } from '../app/src/infrastructure/mongodb.js'
import UserAuditLogHandler from '../app/src/Features/User/UserAuditLogHandler.js'
import fs from 'node:fs/promises'
import * as csv from 'csv'
import { promisify } from 'node:util'
import _ from 'lodash'

const CSV_FILENAME = '/tmp/remove_unconfirmed_emails.csv'
/**
 * @type {(records: string[][]) => Promise<string>}
 */
const stringifyAsync = promisify(csv.stringify)
/**
 * @type {(csvString: string) => Promise<string[][]>}
 */
const parseAsync = promisify(csv.parse)

function usage() {
  console.log('Usage: node remove_unconfirmed_emails.mjs')
  console.log('Removes unconfirmed emails from users')
  console.log('Options:')
  console.log(
    '' +
      '  --generate     generate the CSV file (remove_unconfirmed_emails.csv) containing the emails to remove\n' +
      '  --consume      consume the CSV file (remove_unconfirmed_emails.csv) and remove the emails (by default it is a dry-run)\n' +
      '  --commit       apply the changes (to be used with --consume)\n'
  )
  process.exit(0)
}

const { generate, consume, commit, help } = minimist(process.argv.slice(2), {
  boolean: ['generate', 'consume', 'commit', 'help'],
  alias: { help: 'h' },
  default: { generate: false, consume: false, commit: false },
})

async function generateCsvFile() {
  console.time('generate_csv')

  let processedUsersCount = 0
  let skippedUnconfirmedPrimaries = 0
  let totalEmailsToRemove = 0
  let totalUsersInCsv = 0

  const records = [['User ID', 'Email', 'Sign Up Date']]

  await batchedUpdate(
    db.users,
    {
      $and: [
        { emails: { $exists: true } },
        { emails: { $not: { $size: 0 } } },
        // Warning: this also matches unconfirmed primary emails
        {
          emails: {
            $elemMatch: {
              $or: [{ confirmedAt: { $exists: false } }, { confirmedAt: null }],
            },
          },
        },
      ],
    },
    async users => {
      console.log('Process', users.length, 'users')
      processedUsersCount += users.length

      for (const user of users) {
        const unconfirmedSecondaries = user.emails.filter(
          email => !email.confirmedAt && email.email !== user.email
        )

        if (unconfirmedSecondaries.length === 0) {
          // Users can have been selected because of their unconfirmed primary email
          // we don't want to remove those
          skippedUnconfirmedPrimaries++
          continue
        }

        for (const email of unconfirmedSecondaries) {
          records.push([
            user._id.toString(),
            email.email,
            user.signUpDate.toISOString(),
          ])
        }

        totalUsersInCsv++
        totalEmailsToRemove += unconfirmedSecondaries.length
      }
    },
    { _id: 1, signUpDate: 1, emails: 1, email: 1 }
  )

  const csvContent = await stringifyAsync(records)
  await fs.writeFile(CSV_FILENAME, csvContent)

  console.log()
  console.log('Processed users:', processedUsersCount)
  console.log()
  console.log('Generated CSV file:', CSV_FILENAME)
  console.log('Total emails in the CSV:', totalEmailsToRemove)
  console.log('Total users in the CSV:', totalUsersInCsv)
  console.log(
    'Unconfirmed primary emails (skipped):',
    skippedUnconfirmedPrimaries
  )
  console.log()
  console.timeEnd('generate_csv')
  console.log()
}

async function consumeCsvFile() {
  console.time('consume_csv')

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
  let removedEmailsCount = 0
  let totalModifiedUsersCount = 0
  const skippedEmail = {
    userNotFound: 0,
    nowConfirmed: 0,
    nowPrimary: 0,
    nowRemoved: 0,
  }

  console.log('Total emails in the CSV:', rows.length)
  console.log('Total users in the CSV:', userIds.length)

  for (const userId of userIds) {
    const emailsToRemove = emailsByUserId[userId]

    const user = await db.users.findOne({ _id: new ObjectId(userId) })
    if (!user) {
      skippedEmail.userNotFound += emailsToRemove.length
      continue
    }

    const emailsToRemoveNow = emailsToRemove.filter(email => {
      const currentEmail = user.emails.find(e => e.email === email)
      if (!currentEmail) {
        skippedEmail.nowRemoved++
        return false
      }
      if (currentEmail.confirmedAt) {
        skippedEmail.nowConfirmed++
        return false
      }
      if (currentEmail.email === user.email) {
        skippedEmail.nowPrimary++
        return false
      }
      return true
    })

    removedEmailsCount += emailsToRemoveNow.length

    if (commit && emailsToRemoveNow.length > 0) {
      for (const email of emailsToRemove) {
        await UserAuditLogHandler.promises.addEntry(
          userId,
          'remove-email',
          undefined,
          undefined,
          {
            removedEmail: email,
            script: true,
            note: 'remove unconfirmed secondary emails',
          }
        )
      }

      const updated = await db.users.updateOne(
        { _id: new ObjectId(userId) },
        { $pull: { emails: { email: { $in: emailsToRemove } } } }
      )
      totalModifiedUsersCount += updated.modifiedCount
    }

    processedUsersCount++
    if (processedUsersCount % 100 === 0) {
      console.log('Processed', processedUsersCount, 'users')
    }
  }

  console.log()
  if (!commit) {
    console.log('Dry-run, use --commit to apply changes')
    console.log('This would be the result:')
    console.log()
  }

  console.log('Total emails in the CSV:', rows.length)
  console.log('Total users in the CSV:', userIds.length)
  console.log('Total users processed:', processedUsersCount)
  console.log('Total emails removed:', removedEmailsCount)
  console.log('Skipped emails:', _.sum(Object.values(skippedEmail)))
  console.log('  - User not found:', skippedEmail.userNotFound)
  console.log('  - Email now confirmed:', skippedEmail.nowConfirmed)
  console.log('  - Email now primary:', skippedEmail.nowPrimary)
  console.log('  - Email now removed:', skippedEmail.nowRemoved)
  console.log()

  if (commit) {
    console.log('Total users modified:', totalModifiedUsersCount)
  } else {
    console.log('Note: this was a dry-run. No changes were made.')
  }
  console.log()
  console.timeEnd('consume_csv')
  console.log()
}

async function main() {
  if (help) {
    return usage()
  }

  if (!generate && !consume) {
    console.error('Error: Either --generate or --consume must be specified')
    return usage()
  }

  if (generate && consume) {
    console.error('Error: Cannot use both --generate and --consume together')
    return usage()
  }

  if (commit && !consume) {
    console.error('Error: --commit can only be used with --consume')
    return usage()
  }

  if (generate) {
    await generateCsvFile()
  } else if (consume) {
    await consumeCsvFile()
  }
}

try {
  await main()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
