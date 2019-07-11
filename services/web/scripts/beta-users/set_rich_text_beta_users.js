const fs = require('fs')
const path = require('path')
const mongojs = require('../../app/src/infrastructure/mongojs')
const { db, ObjectId } = mongojs
const async = require('async')

console.log('Finding users for ids specified')

const text = fs.readFileSync(path.join(__dirname, 'beta-users.txt'))
const textByLine = text
  .toString()
  .split('\n')
  .map(function(stringId) {
    return ObjectId(stringId)
  })

db.users.find({ _id: { $in: textByLine } }, function(err, users) {
  if (err) throw err

  if (users.length) {
    console.log('Found ' + users.length + ' users')

    async.each(
      users,
      function(user, callback) {
        console.log('setting betaProgram==true for: ' + user._id)
        db.users.update(
          {
            _id: user._id
          },
          {
            $set: {
              betaProgram: true
            }
          },
          callback
        )
      },
      function(result, err) {
        if (err) {
          console.log(err)
        }
        process.exit(0)
      }
    )
  } else {
    console.log('No users found matching those ids')
    process.exit(0)
  }
})
