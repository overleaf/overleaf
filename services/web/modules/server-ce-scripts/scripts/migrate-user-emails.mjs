// Script to migrate user emails using a CSV file with the following format:
//
//  oldEmail,newEmail
//
// The script will iterate through the CSV file and update the user's email
// address from oldEmail to newEmail, after checking all the email addresses
// for duplicates.
//
// Intended for Server Pro customers migrating user emails from one domain to
// another.

import minimist from 'minimist'

import os from 'os'
import fs from 'fs'
import * as csv from 'csv/sync'
import { parseEmail } from '../../../app/src/Features/Helpers/EmailHelper.js'
import UserGetter from '../../../app/src/Features/User/UserGetter.js'
import UserUpdater from '../../../app/src/Features/User/UserUpdater.js'
import UserSessionsManager from '../../../app/src/Features/User/UserSessionsManager.js'

const hostname = os.hostname()
const scriptTimestamp = new Date().toISOString()

// support command line option of --commit to actually do the migration
const argv = minimist(process.argv.slice(2), {
  boolean: ['commit', 'ignore-missing'],
  string: ['admin-id'],
  alias: {
    'ignore-missing': 'continue',
  },
  default: {
    commit: false,
    'ignore-missing': false,
    'admin-id': '000000000000000000000000', // use a dummy admin ID for script audit log entries
  },
})

// display usage if no CSV file is provided
if (argv._.length === 0) {
  console.log(
    'Usage: node migrate_user_emails.mjs [--commit] [--continue|--ignore-missing] [--admin-id=ADMIN_USER_ID] <csv_file>'
  )
  console.log('  --commit: actually do the migration (default: false)')
  console.log(
    '  --continue|--ignore-missing: continue on missing or already-migrated users'
  )
  console.log('  --admin-id: admin user ID to use for audit log entries')
  console.log('  <csv_file>: CSV file with old and new email addresses')
  process.exit(1)
}

function filterEmails(rows) {
  // check that emails have a valid format
  const result = []
  const seenOld = new Set()
  const seenNew = new Set()
  for (const [oldEmail, newEmail] of rows) {
    const parsedOld = parseEmail(oldEmail)
    const parsedNew = parseEmail(newEmail)
    if (!parsedOld) {
      throw new Error(`invalid old email "${oldEmail}"`)
    }
    if (!parsedNew) {
      throw new Error(`invalid new email "${newEmail}"`)
    }
    // Check for duplicates and overlaps
    if (seenOld.has(parsedOld)) {
      throw new Error(`Duplicate old emails found in CSV file ${oldEmail}.`)
    }
    if (seenNew.has(parsedNew)) {
      throw new Error(`Duplicate new emails found in CSV file ${newEmail}.`)
    }
    if (seenOld.has(parsedNew) || seenNew.has(parsedOld)) {
      throw new Error(
        `Old and new emails cannot overlap ${oldEmail} ${newEmail}`
      )
    }
    seenOld.add(parsedOld)
    seenNew.add(parsedNew)
    result.push([parsedOld, parsedNew])
  }
  return result
}

async function checkEmailsAgainstDb(emails) {
  const result = []
  for (const [oldEmail, newEmail] of emails) {
    const userWithEmail = await UserGetter.promises.getUserByMainEmail(
      oldEmail,
      {
        _id: 1,
      }
    )
    if (!userWithEmail) {
      if (argv['ignore-missing']) {
        console.log(
          `User with email "${oldEmail}" not found, skipping update to "${newEmail}"`
        )
        continue
      } else {
        throw new Error(`no user found with email "${oldEmail}"`)
      }
    }
    const userWithNewEmail = await UserGetter.promises.getUserByAnyEmail(
      newEmail,
      {
        _id: 1,
      }
    )
    if (userWithNewEmail) {
      throw new Error(
        `new email "${newEmail}" already exists for user ${userWithNewEmail._id}`
      )
    }
    result.push([oldEmail, newEmail])
  }
  return result
}

async function doMigration(emails) {
  let success = 0
  let failure = 0
  let skipped = 0
  for (const [oldEmail, newEmail] of emails) {
    const userWithEmail = await UserGetter.promises.getUserByMainEmail(
      oldEmail,
      {
        _id: 1,
      }
    )
    if (!userWithEmail) {
      if (argv['ignore-missing']) {
        continue
      } else {
        throw new Error(`no user found with email "${oldEmail}"`)
      }
    }
    if (argv.commit) {
      console.log(
        `Updating user ${userWithEmail._id} email "${oldEmail}" to "${newEmail}"\n`
      )
      try {
        // log out all the user's sessions before changing the email address
        await UserSessionsManager.promises.removeSessionsFromRedis(
          userWithEmail
        )

        await UserUpdater.promises.migrateDefaultEmailAddress(
          userWithEmail._id,
          oldEmail,
          newEmail,
          {
            initiatorId: argv['admin-id'],
            ipAddress: hostname,
            extraInfo: {
              script: 'migrate_user_emails.js',
              runAt: scriptTimestamp,
            },
          }
        )
        success++
      } catch (err) {
        console.log(err)
        failure++
      }
    } else {
      console.log(`Dry run, skipping update from ${oldEmail} to ${newEmail}`)
      skipped++
    }
  }
  console.log('Success: ', success, 'Failure: ', failure, 'Skipped: ', skipped)
  if (failure > 0) {
    throw new Error('Some email migrations failed')
  }
}

async function migrateEmails() {
  console.log('Starting email migration script')
  const csvFilePath = argv._[0]
  const csvFile = fs.readFileSync(csvFilePath, 'utf8')
  const rows = csv.parse(csvFile)
  console.log('Number of users to migrate: ', rows.length)
  const emails = filterEmails(rows)
  const existingUserEmails = await checkEmailsAgainstDb(emails)
  await doMigration(existingUserEmails)
}

migrateEmails()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
