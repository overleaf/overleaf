const Settings = require('@overleaf/settings')
const { db, waitForDb } = require('../../../app/src/infrastructure/mongodb')
const UserRegistrationHandler = require('../../../app/src/Features/User/UserRegistrationHandler')
const OneTimeTokenHandler = require('../../../app/src/Features/Security/OneTimeTokenHandler')

async function main() {
  await waitForDb()

  const email = (process.argv.slice(2).pop() || '').replace(/^--email=/, '')
  if (!email) {
    console.error(`Usage: node ${__filename} --email=joe@example.com`)
    process.exit(1)
  }

  await new Promise((resolve, reject) => {
    UserRegistrationHandler.registerNewUser(
      {
        email,
        password: require('crypto').randomBytes(32).toString('hex'),
      },
      (error, user) => {
        if (error && error.message !== 'EmailAlreadyRegistered') {
          return reject(error)
        }
        db.users.updateOne(
          { _id: user._id },
          { $set: { isAdmin: true } },
          error => {
            if (error) {
              return reject(error)
            }
            const ONE_WEEK = 7 * 24 * 60 * 60 // seconds
            OneTimeTokenHandler.getNewToken(
              'password',
              {
                expiresIn: ONE_WEEK,
                email: user.email,
                user_id: user._id.toString(),
              },
              (err, token) => {
                if (err) {
                  return reject(err)
                }

                console.log('')
                console.log(`\
Successfully created ${email} as an admin user.

Please visit the following URL to set a password for ${email} and log in:

${Settings.siteUrl}/user/password/set?passwordResetToken=${token}
\
`)
                resolve()
              }
            )
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
