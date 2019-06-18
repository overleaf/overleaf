const { db } = require('../app/src/infrastructure/mongojs')
const Async = require('async')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))
const limit = argv.limit

if (!limit) {
  console.log('Please supply an async limit with --limit')
  process.exit(1)
}

db.users.find(
  { hashedPassword: { $exists: 1 }, sharelatexHashedPassword: { $exists: 0 } },
  { hashedPassword: 1 },
  (err, users) => {
    if (err) {
      throw err
    }

    Async.eachLimit(
      users,
      limit,
      (user, cb) => {
        db.users.update(
          { _id: user._id },
          { $set: { sharelatexHashedPassword: user.hashedPassword } },
          cb
        )
      },
      err => {
        if (err) {
          throw err
        }
        console.log('finished')
        process.exit(0)
      }
    )
  }
)
