// Run all the mongo queries on secondaries
process.env.MONGO_CONNECTION_STRING =
  process.env.READ_ONLY_MONGO_CONNECTION_STRING

const { ObjectId, waitForDb } = require('../app/src/infrastructure/mongodb')
const UserUpdater = require('../app/src/Features/User/UserUpdater')
const UserGetter = require('../app/src/Features/User/UserGetter')

waitForDb()
  .then(removeEmail)
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .then(() => {
    console.log('Done.')
    process.exit()
  })

async function removeEmail() {
  const userId = process.argv[2]
  let email = process.argv[3]

  if (!ObjectId.isValid(userId)) {
    throw new Error(`user ID ${userId} is not valid`)
  }

  if (!email) {
    throw new Error('no email provided')
  }

  // email arg can be within double quotes for arg so that we can handle
  // malformed emails with spaces
  email = email.replace(/"/g, '')

  console.log(
    `\nBegin request to remove email "${email}" from user "${userId}"\n`
  )

  const userWithEmail = await UserGetter.promises.getUserByAnyEmail(email, {
    _id: 1,
  })

  if (!userWithEmail) {
    throw new Error(`no user found with email "${email}"`)
  }

  if (userWithEmail._id.toString() !== userId) {
    throw new Error(
      `email does not belong to user. Belongs to ${userWithEmail._id}`
    )
  }

  const skipParseEmail = true
  await UserUpdater.promises.removeEmailAddress(userId, email, skipParseEmail)
}
