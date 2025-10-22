import UserGetter from '../../../app/src/Features/User/UserGetter.mjs'
import UserDeleter from '../../../app/src/Features/User/UserDeleter.mjs'
import { fileURLToPath } from 'url'
import minimist from 'minimist'

const filename = fileURLToPath(import.meta.url)

async function main() {
  const argv = minimist(process.argv.slice(2), {
    string: ['email'],
    boolean: ['skip-email'],
  })

  const { email, 'skip-email': skipEmail } = argv
  if (!email) {
    console.error(
      `Usage: node ${filename} [--skip-email] --email=joe@example.com

Deletes a user. All users' projects will also be deleted.

Options:
    --email          email address of the user being deleted
    --skip-email    (optional) when present, the user is not notified of the deletion via email
`
    )
    process.exit(1)
  }

  await new Promise((resolve, reject) => {
    UserGetter.getUser({ email }, { _id: 1 }, function (error, user) {
      if (error) {
        return reject(error)
      }
      if (!user) {
        console.log(
          `user ${email} not in database, potentially already deleted`
        )
        return resolve()
      }
      const options = {
        ipAddress: '0.0.0.0',
        force: true,
        skipEmail,
      }
      UserDeleter.deleteUser(user._id, options, function (err) {
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
