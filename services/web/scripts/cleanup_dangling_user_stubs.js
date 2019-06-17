const { db } = require('../app/src/infrastructure/mongojs')
const async = require('async')
const minimist = require('minimist')
const UserMapper = require('../modules/overleaf-integration/app/src/OverleafUsers/UserMapper')

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined

if (!commit) {
  console.log('Doing dry run without --commit')
}

db.userstubs.aggregate(
  [
    {
      $lookup: {
        localField: 'overleaf.id',
        from: 'users',
        foreignField: 'overleaf.id',
        as: 'users'
      }
    },
    {
      $project: {
        email: 1,
        overleaf: 1,
        _id: 1,
        'users.email': 1,
        'users.emails': 1,
        'users.overleaf': 1,
        'users._id': 1
      }
    },
    {
      $match: {
        users: { $exists: 1 },
        'overleaf.id': { $exists: 1 }
      }
    }
  ],
  (err, stubs) => {
    if (err) {
      throw err
    }
    console.log('Found ' + stubs.length + ' dangling stubs')
    async.mapLimit(
      stubs,
      Number(argv.limit || '10'),
      (stub, callback) => {
        if (commit) {
          if (stub.users.length === 0) {
            console.log('Deleting stub without users:', stub._id)
            return db.userstubs.remove({ _id: stub._id }, callback)
          }
          if (stub.users.length > 1) {
            console.log('Found stub with multiple users:', stub)
            return callback()
          }
          console.log(
            'Processing stub',
            stub._id,
            'for user',
            stub.users[0]._id
          )
          UserMapper._updateUserStubReferences(
            stub.overleaf,
            stub._id,
            stub.users[0]._id,
            callback
          )
        } else {
          if (stub.users.length === 0) {
            console.log('Would delete stub without users:', stub._id)
            return callback()
          }
          if (stub.users.length > 1) {
            console.log('Found stub with multiple users:', stub)
            return callback()
          }
          console.log(
            'Would call UserMapper._updateUserStubReferences with:',
            stub.overleaf,
            stub._id,
            stub.users[0]._id
          )
          callback()
        }
      },
      err => {
        if (err) {
          throw err
        }
        console.log('All done')
        process.exit(0)
      }
    )
  }
)
