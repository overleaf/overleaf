// @ts-check

import { db, ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import fs from 'node:fs/promises'
import * as csv from 'csv'
import { promisify } from 'node:util'
import { scriptRunner } from './lib/ScriptRunner.mjs'
import { READ_PREFERENCE_SECONDARY } from '@overleaf/mongo-utils/batchedUpdate.js'
import { fetchJson, fetchNothing } from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'
import path from 'path-browserify'
import { fileURLToPath } from 'node:url'
import minimist from 'minimist'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV_FILENAME = './tmp/unconfirmed_emails_removed.csv'

const argv = minimist(process.argv.slice(2))
const commit = argv.commit === 'true'
const doNotListUsers = argv.do_not_list_users === 'true'

console.log(
  'Begin remove affiliations not removed in v1 when unconfirmed secondary email was removed from user account'
)

if (commit) {
  console.log('\nRunning in COMMIT mode, changes will be made in v1\n')
} else {
  console.log(
    '\nRunning in DRY-RUN mode, no changes will be made in v1, only reporting results. To commit changes run with --commit=true\n'
  )
}

if (!doNotListUsers) {
  console.log(
    'Full results lists will be outputed. To not list users run with --do_not_list_users=true\n'
  )
}

/**
 * @type {(csvString: string) => Promise<string[][]>}
 */
const parseAsync = promisify(csv.parse)

/**
 * @param {any} userId
 */
async function getV1Affiliations(userId) {
  const url = `${Settings.apis.v1.url}/api/v2/users/${userId}/affiliations`

  const affiliations = await fetchJson(url, {
    basicAuth: {
      user: Settings.apis.v1.user,
      password: Settings.apis.v1.pass,
    },
    signal: AbortSignal.timeout(Settings.apis.v1.timeout),
  })

  return affiliations
}

/**
 * @param {any} userId
 * @param {any} email
 */
async function removeAffiliationV1(userId, email) {
  const url = `${Settings.apis.v1.url}/api/v2/users/${userId}/affiliations/remove`

  await fetchNothing(url, {
    method: 'POST',
    json: { email },
    basicAuth: {
      user: Settings.apis.v1.user,
      password: Settings.apis.v1.pass,
    },
    signal: AbortSignal.timeout(Settings.apis.v1.timeout),
    defaultErrorMessage: "Couldn't remove affiliation",
  })
}

const results = {
  /** @type {string[]} */
  userNotFound: [],
  /** @type {string[]} */
  userNotFoundInV1: [],
  /** @type {{email: string, userId: string}[]} */
  emailNotInV1ForUser: [],
  /** @type {{email: string, userId: string}[]} */
  needToRemoveEmailInV1: [],
  /** @type {{email: string, userId: string}[]} */
  successfullyRemovedEmailInV1ForUser: [],
  /** @type {{email: string, userId: string}[]} */
  emailStillOnAccount: [],
  /** @type {{email: string, userId: string}[]} */
  emailNowOnOtherAccount: [],
  /** @type {string[]} */
  errorCheckingAffiliations: [],
  /** @type {{email: string, userId: string, status?: number}[]} */
  errorRemovingAffiliationInV1: [],
}

/**
 * @param {any} trackProgress
 */
async function main(trackProgress) {
  console.time('check_removed_emails')

  const filePath = path.join(__dirname, CSV_FILENAME)
  const csvContent = await fs.readFile(filePath, 'utf8')
  const rows = await parseAsync(csvContent)
  rows.shift() // Remove header row
  /** @type {Record<string, string[]>} */
  const emailsByUserId = {}

  for (const [userId, email] of rows) {
    if (!emailsByUserId[userId]) {
      emailsByUserId[userId] = []
    }
    emailsByUserId[userId].push(email.trim())
  }

  const userIds = Object.keys(emailsByUserId)
  let processedUsersCount = 0

  console.log('Total emails in the CSV:', rows.length)
  console.log('Total users in the CSV:', userIds.length)

  for (const userId of userIds) {
    const removedEmails = emailsByUserId[userId] // these will be emails that had affiliations and not. they were removed from the user account, but we didn't remove the affiliations in v1 (if they existed)
    let affiliations
    try {
      affiliations = await getV1Affiliations(userId)
      if (!affiliations.length) {
        results.userNotFoundInV1.push(userId)
        // nothing to cleanup in v1 if no affiliations for the user
        continue
      }
    } catch (/** @type {any} */ e) {
      results.errorCheckingAffiliations.push(userId)
    }

    const affiliationsEmailsInV1 = affiliations.map(
      (/** @type {any} */ affiliation) => affiliation.email
    )

    const user = await db.users.findOne(
      { _id: new ObjectId(userId) },
      { readPreference: READ_PREFERENCE_SECONDARY, projection: { emails: 1 } }
    )

    if (!user) {
      // user was deleted but their affiliations still persist in v1,
      // we should cleanup v1, otherwise email cannot be added to other accounts
      results.userNotFound.push(userId)
    }

    for (const email of removedEmails) {
      if (!affiliationsEmailsInV1.includes(email)) {
        // the email removed is not in v1 affiliations for the user ID it was removed from,
        // this is expected and good (either email had no affiliation or somehow the affiliation did get removed), no cleanup needed in v1
        results.emailNotInV1ForUser.push({ userId, email })
        continue
      }

      const emailOnAccount = user?.emails?.find(
        (/** @type {any} */ e) => e.email === email
      )

      if (emailOnAccount) {
        // the email is still on the user account, we should not remove the affiliation in v1
        results.emailStillOnAccount.push({ userId, email })
        continue
      } else {
        // we'll remove the email affiliation in v1 but let's also check if the email is now on another user's account
        // this should error but if it did get added then it would be added without an affiliation
        // possibly ok because maybe email is not affiliated, but worth investigating if this happened because if it was added without an affiliation then that
        // could put the user into a bad state (no access to Commons license, no visibility in metrics, not captured by group with domain capture, etc)
        const query = { emails: { $exists: true }, 'emails.email': email } // $exists: true MUST be set to use the partial index
        const otherUserWithEmail = await db.users.findOne(query, {
          readPreference: READ_PREFERENCE_SECONDARY,
        })
        if (otherUserWithEmail) {
          results.emailNowOnOtherAccount.push({
            email,
            userId: otherUserWithEmail._id.toString(),
          })
        }
      }

      results.needToRemoveEmailInV1.push({ userId, email })
      if (commit) {
        // only make the changes if script arg is 'commit', otherwise just report results
        try {
          // remove the affiliation in v1
          await removeAffiliationV1(userId, email)
          results.successfullyRemovedEmailInV1ForUser.push({ userId, email })
        } catch (/** @type {any} */ e) {
          results.errorRemovingAffiliationInV1.push({
            userId,
            email,
            // @ts-ignore
            status: e.info?.status,
          })
        }
      }
    }

    processedUsersCount++
    if (processedUsersCount % 100 === 0) {
      trackProgress(`Processed ${processedUsersCount} users`)
    }
  }

  console.log('Results:')
  for (const key in results) {
    console.log(`   ${key}:`, /** @type {any} */ (results)[key].length)
  }
  for (const key in results) {
    if (
      !doNotListUsers &&
      /** @type {any} */ (results)[key].length > 0 &&
      key !== 'needToRemoveEmailInV1'
    ) {
      // skip needToRemoveEmailInV1 since we'll only output that if this list length does not match success list length
      console.log('----------------------------')
      console.log(`${key}:`)
      console.log(/** @type {any} */ (results)[key])
    }
  }

  if (
    commit &&
    !doNotListUsers &&
    results.needToRemoveEmailInV1.length !==
      results.successfullyRemovedEmailInV1ForUser.length
  ) {
    // avoid outputting this list twice since it will be quite long. Only output those that need to be removed and were not successfully removed

    const expectedToBeRemovedButWerent = results.needToRemoveEmailInV1.filter(
      needToRemove =>
        !results.successfullyRemovedEmailInV1ForUser.some(
          successfullyRemoved =>
            successfullyRemoved.userId === needToRemove.userId &&
            successfullyRemoved.email === needToRemove.email
        )
    )

    console.log(
      '----------------------------\nEmails that needed to be removed in v1 but were not successfully removed:'
    )
    console.log(expectedToBeRemovedButWerent)
  }
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
