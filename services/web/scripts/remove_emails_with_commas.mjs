// @ts-check

import minimist from 'minimist'
import fs from 'node:fs/promises'
import * as csv from 'csv'
import { promisify } from 'node:util'
import UserAuditLogHandler from '../app/src/Features/User/UserAuditLogHandler.js'
import { db } from '../app/src/infrastructure/mongodb.js'

const CSV_FILENAME = '/tmp/emails-with-commas.csv'

/**
 * @type {(csvString: string) => Promise<string[][]>}
 */
const parseAsync = promisify(csv.parse)

function usage() {
  console.log('Usage: node remove_emails_with_commas.mjs')
  console.log(`Read emails from ${CSV_FILENAME} and remove them from users.`)
  console.log('Add support+<encoded_email>@overleaf.com instead.')
  console.log('Options:')
  console.log('  --commit       apply the changes\n')
  process.exit(0)
}

const { commit, help } = minimist(process.argv.slice(2), {
  boolean: ['commit', 'help'],
  alias: { help: 'h' },
  default: { commit: false },
})

async function consumeCsvFileAndUpdate() {
  console.time('remove_emails_with_commas')

  const csvContent = await fs.readFile(CSV_FILENAME, 'utf8')
  const rows = await parseAsync(csvContent)
  const emailsWithComma = rows.map(row => row[0])

  console.log('Total emails in the CSV:', emailsWithComma.length)

  const unexpectedValidEmails = emailsWithComma.filter(
    str => !str.includes(',')
  )
  if (unexpectedValidEmails.length > 0) {
    throw new Error(
      'CSV file contains unexpected valid emails: ' +
        JSON.stringify(emailsWithComma)
    )
  }

  let updatedUsersCount = 0
  for (const oldEmail of emailsWithComma) {
    const encodedEmail = oldEmail
      .replaceAll('_', '_5f')
      .replaceAll('@', '_40')
      .replaceAll(',', '_2c')
      .replaceAll('<', '_60')
      .replaceAll('>', '_62')

    const newEmail = `support+${encodedEmail}@overleaf.com`

    console.log(oldEmail, '->', newEmail)

    const user = await db.users.findOne({ email: oldEmail })

    if (!user) {
      console.log('User not found for email:', oldEmail)
      continue
    }

    if (commit) {
      await db.users.updateOne(
        { _id: user._id },
        {
          $set: { email: newEmail },
          $pull: { emails: { email: oldEmail } },
        }
      )
      await db.users.updateOne(
        { _id: user._id },
        {
          $addToSet: {
            emails: {
              email: newEmail,
              createdAt: Date.now(),
              reversedHostname: 'moc.faelrevo',
            },
          },
        }
      )

      await UserAuditLogHandler.promises.addEntry(
        user._id,
        'remove-email',
        undefined,
        undefined,
        {
          removedEmail: oldEmail,
          script: true,
          note: 'remove primary email containing commas',
        }
      )
      updatedUsersCount++
    }
  }

  console.log('Updated users:', updatedUsersCount)

  if (!commit) {
    console.log('Note: this was a dry-run. No changes were made.')
  }
  console.log()
  console.timeEnd('remove_emails_with_commas')
  console.log()
}

try {
  if (help) usage()
  else await consumeCsvFileAndUpdate()
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
