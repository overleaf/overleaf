import UserGetter from '../../../app/src/Features/User/UserGetter.js'
import UserDeleter from '../../../app/src/Features/User/UserDeleter.js'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)

async function main() {
  const email = (process.argv.slice(2).pop() || '').replace(/^--email=/, '')
  if (!email) {
    console.error(`Usage: node ${filename} --email=joe@example.com`)
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
