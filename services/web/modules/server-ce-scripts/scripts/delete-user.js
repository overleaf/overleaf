const { waitForDb } = require('../../../app/src/infrastructure/mongodb')
const UserGetter = require('../../../app/src/Features/User/UserGetter')
const UserDeleter = require('../../../app/src/Features/User/UserDeleter')

async function main() {
  await waitForDb()

  const email = (process.argv.slice(2).pop() || '').replace(/^--email=/, '')
  if (!email) {
    console.error(`Usage: node ${__filename} --email=joe@example.com`)
    process.exit(1)
  }

  await new Promise((resolve, reject) => {
    UserGetter.getUser({ email }, function (error, user) {
      if (error) {
        return reject(error)
      }
      if (!user) {
        console.log(
          `user ${email} not in database, potentially already deleted`
        )
        return resolve()
      }
      UserDeleter.deleteUser(user._id, function (err) {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
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
