const { User } = require('../app/src/models/User')
const UserUpdater = require('../app/src/Features/User/UserUpdater')
require('logger-sharelatex').logger.level('error')
const pLimit = require('p-limit')
const CONCURRENCY = 10
const unexpectedUserStates = []

console.log('Starting SSO affiliation backfill')

const query = {
  emails: {
    $elemMatch: {
      samlProviderId: { $exists: true },
      confirmedAt: { $exists: false }
    }
  }
}

async function backfillAffiliation(user) {
  const ssoEmail = user.emails.filter(
    emailData => !emailData.confirmedAt && emailData.samlProviderId
  )
  if (ssoEmail.length > 1 || ssoEmail.length === 0) {
    unexpectedUserStates.push(user._id)
  }
  const { email } = ssoEmail[0]
  await UserUpdater.promises.confirmEmail(user._id, email)
}

async function getUsers() {
  return User.find(query, { emails: 1 }).exec()
}

async function run() {
  const limit = pLimit(CONCURRENCY)
  const users = await getUsers()
  console.log(`Found ${users.length} users`)
  await Promise.all(users.map(user => limit(() => backfillAffiliation(user))))
  console.log('Finished')
  console.log(
    `Found ${unexpectedUserStates.length} in unexpected states`,
    unexpectedUserStates
  )
}

run()
  .then(() => {
    process.exit()
  })
  .catch(error => {
    console.log(error)
    process.exit(1)
  })
