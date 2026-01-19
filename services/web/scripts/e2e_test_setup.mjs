import fs from 'node:fs'
import Path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'
import { connectionPromise, db } from '../app/src/infrastructure/mongodb.mjs'
import GracefulShutdown from '../app/src/infrastructure/GracefulShutdown.mjs'
import ProjectDeleter from '../app/src/Features/Project/ProjectDeleter.mjs'
import SplitTestManager from '../app/src/Features/SplitTests/SplitTestManager.mjs'
import UserDeleter from '../app/src/Features/User/UserDeleter.mjs'
import UserRegistrationHandler from '../app/src/Features/User/UserRegistrationHandler.mjs'

const MONOREPO = Path.dirname(
  Path.dirname(Path.dirname(Path.dirname(fileURLToPath(import.meta.url))))
)

/**
 * @param {string} email
 * @return {Promise<void>}
 */
async function createUser(email) {
  const user = await UserRegistrationHandler.promises.registerNewUser({
    email,
    password: process.env.CYPRESS_DEFAULT_PASSWORD,
  })
  const features = email.startsWith('free+')
    ? Settings.defaultFeatures
    : Settings.features.professional
  await db.users.updateOne(
    { _id: user._id },
    {
      $set: {
        // Set admin flag.
        isAdmin: email.startsWith('admin+'),
        adminRoles: email.startsWith('admin+') ? ['engineering'] : [],
        // Disable spell-checking for performance and flakiness reasons.
        'ace.spellCheckLanguage': '',
        // Override features.
        features,
        featuresOverrides: [{ features }],
        // disable Writefull
        'writefull.enabled': false,
      },
    }
  )
}

/**
 * @param {string} email
 * @return {Promise<void>}
 */
async function deleteUser(email) {
  const user = await db.users.findOne({ email })
  if (!user) return
  // Delete the subscriptions of the user
  await db.subscriptions.deleteMany({ admin_id: user._id })
  // Soft delete the user.
  await UserDeleter.promises.deleteUser(user._id, {
    force: true,
    ipAddress: '0.0.0.0',
  })
  // Hard-delete the users projects.
  const projects = await db.deletedProjects
    .find(
      { 'deleterData.deletedProjectOwnerId': user._id },
      { projection: { deletedProjectId: 1 } }
    )
    .toArray()
  await promiseMapWithLimit(
    10,
    projects.map(p => p.deletedProjectId),
    ProjectDeleter.promises.expireDeletedProject
  )
  // Hard-delete the user.
  await UserDeleter.promises.expireDeletedUser(user._id)
}

/**
 * @param {string} email
 * @return {Promise<void>}
 */
async function provisionUser(email) {
  if (!email.includes('+')) {
    throw new Error(
      `email=${email} should include the test suite name, e.g. user+project-sharing@example.com`
    )
  }
  await deleteUser(email)
  await createUser(email)
}

async function provisionUsers() {
  const emails = Settings.recaptcha.trustedUsers
  console.log(`> Provisioning ${emails.length} E2E users.`)
  await promiseMapWithLimit(5, emails, provisionUser)
}

async function purgeNewUsers() {
  const users = await db.users
    .find(
      { email: Settings.recaptcha.trustedUsersRegex },
      { projection: { email: 1 } }
    )
    .toArray()
  console.log(`> Deleting ${users.length} newly created E2E users.`)
  await promiseMapWithLimit(
    5,
    users.map(user => user.email),
    deleteUser
  )
}

async function provisionSplitTests() {
  const backup = Path.join(
    MONOREPO,
    'backup',
    'split-tests',
    new Date().toISOString() + '.json'
  )
  console.log(
    `> Backing up previous split-tests into ${backup}. You can import them again on https://www.dev-overleaf.com/admin/split-test via the [Import] button.`
  )
  const splitTests = await SplitTestManager.getRuntimeTests()
  await fs.promises.mkdir(Path.dirname(backup), { recursive: true })
  await fs.promises.writeFile(
    backup,
    JSON.stringify(splitTests.sort((a, b) => (a.name > b.name ? 1 : -1)))
  )

  // Imported from production via https://www.overleaf.com/admin/split-test -> "Copy all split tests" -> "Copy for E2E test setup"
  const SPLIT_TESTS = JSON.parse(
    await fs.promises.readFile(
      Path.join(MONOREPO, 'tools/saas-e2e/split-tests.json')
    )
  )
  console.log(`> Importing ${SPLIT_TESTS.length} split-tests from production.`)
  await SplitTestManager.replaceSplitTests(SPLIT_TESTS)
}

async function checkNoTableScan() {
  const client = await connectionPromise
  const { notablescan } = await client
    .db()
    .admin()
    .command({ getParameter: 1, notablescan: 1 })
  if (!notablescan) {
    console.error()
    console.error('!!!  mongo is running without --notablescan')
    console.error()
    console.error('To fix this, either')
    console.error('- run "internal$ bin/e2e_test_setup"')
    console.error(
      '- or add MONGO_EXTRA_ARGS=--notablescan in config/local.env and apply with "internal$ bin/up mongo"'
    )
    console.error()
    throw new Error('mongo is running without --notablescan')
  }
}

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('only available in dev-env')
  }
  await checkNoTableScan()

  await Promise.all([purgeNewUsers(), provisionUsers(), provisionSplitTests()])
}

await main()
await GracefulShutdown.gracefulShutdown(
  {
    close(cb) {
      cb()
    },
  },
  'SIGTERM'
)
