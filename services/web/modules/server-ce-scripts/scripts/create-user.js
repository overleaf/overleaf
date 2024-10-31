const minimist = require('minimist')
const { db } = require('../../../app/src/infrastructure/mongodb')
const UserRegistrationHandler = require('../../../app/src/Features/User/UserRegistrationHandler')

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ['email'],
    boolean: ['admin'],
  })

  const { admin, email } = argv
  if (!email) {
    console.error(`Usage: node ${__filename} [--admin] --email=joe@example.com`)
    process.exit(1)
  }

  await new Promise((resolve, reject) => {
    UserRegistrationHandler.registerNewUserAndSendActivationEmail(
      email,
      (error, user, setNewPasswordUrl) => {
        if (error) {
          return reject(error)
        }
        db.users.updateOne(
          { _id: user._id },
          { $set: { isAdmin: admin } },
          error => {
            if (error) {
              return reject(error)
            }

            console.log('')
            console.log(`\
Successfully created ${email} as ${admin ? 'an admin' : 'a'} user.

Please visit the following URL to set a password for ${email} and log in:

  ${setNewPasswordUrl}

`)
            resolve()
          }
        )
      }
    )
  })
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
