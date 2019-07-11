const { db } = require('../app/src/infrastructure/mongojs')
const async = require('async')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined

if (!commit) {
  console.log('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
}

db.users.aggregate(
  [
    { $match: { 'overleaf.id': { $exists: true } } },
    { $group: { _id: '$overleaf.id', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ],
  { allowDiskUse: true },
  function(err, results) {
    if (err) throw err
    console.log('FOUND ' + results.length + ' DUPLICATES')
    async.mapSeries(results, removeDuplicates, function(err) {
      if (err) throw err
      console.log('DONE')
      process.exit()
    })
  }
)

function removeDuplicates(duplicate, callback) {
  db.users.findOne({ 'overleaf.id': duplicate._id }, function(err, keepUser) {
    if (err) throw err
    console.log('KEEPING USER ' + keepUser._id + ' FOR OL ' + duplicate._id)
    db.users.find(
      { 'overleaf.id': duplicate._id, _id: { $ne: keepUser._id } },
      function(err, duplicateUsers) {
        if (err) throw err
        async.mapSeries(
          duplicateUsers,
          function(user, cb) {
            console.log(
              'UNLINKING USER ' + user._id + ' FOR OL ' + duplicate._id
            )
            if (!commit) return cb()
            db.users.update(
              { _id: user._id },
              { $unset: { 'overleaf.id': '' } },
              cb
            )
          },
          function(err) {
            if (err) throw err
            callback()
          }
        )
      }
    )
  })
}
