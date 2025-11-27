import { ObjectId } from '../app/src/infrastructure/mongodb.mjs'
import UserUpdater from '../app/src/Features/User/UserUpdater.mjs'
import UserGetter from '../app/src/Features/User/UserGetter.mjs'

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

  const auditLog = {
    initiatorId: undefined,
    ipAddress: '0.0.0.0',
    extraInfo: {
      script: true,
    },
  }

  const skipParseEmail = true
  await UserUpdater.promises.removeEmailAddress(
    userId,
    email,
    auditLog,
    skipParseEmail
  )
}
try {
  await removeEmail()
  console.log('Done.')
  process.exit()
} catch (error) {
  console.error(error)
  process.exit(1)
}
