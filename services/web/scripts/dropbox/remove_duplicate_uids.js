const { db } = require('../../app/src/infrastructure/mongojs')
const DropboxHandler = require('../../modules/dropbox/app/src/DropboxHandler')
const EmailHandler = require('../../app/src/Features/Email/EmailHandler')
const async = require('async')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined

if (!commit) {
  console.log('DOING DRY RUN. TO SAVE CHANGES PASS --commit')
}

db.users.aggregate(
  [
    {
      $group: {
        // group by Dropbox access token uid and count distinct users
        _id: '$dropbox.access_token.uid',
        count: { $sum: 1 },
        _ids: { $addToSet: '$_id' }
      }
    },
    {
      $match: {
        // select only uids userd more than once
        _id: { $ne: null },
        count: { $gt: 1 }
      }
    },
    {
      $project: {
        // filter output
        _id: false,
        dropbox_uid: '$_id',
        _ids: '$_ids'
      }
    }
  ],
  { allowDiskUse: true },
  function(error, results) {
    if (error) throw error
    console.log('FOUND ' + results.length + ' DUPLICATES')
    async.mapSeries(results, removeDuplicates, function(error) {
      if (error) throw error
      console.log('DONE')
      process.exit()
    })
  }
)

function removeDuplicates(duplicate, callback) {
  async.mapSeries(duplicate._ids, unlinkUser, function(error) {
    callback(error)
  })
}

function unlinkUser(_id, callback) {
  db.users.findOne({ _id: _id }, function(error, user) {
    if (error) return callback(error)
    console.log('UNLINKING USER ' + _id + ' (' + user.email + ')')
    if (!commit) return callback()
    DropboxHandler.unlinkAccount(_id, function(error) {
      if (error) return callback(error)
      EmailHandler.sendEmail(
        'dropboxUnlinkedDuplicate',
        { to: user.email },
        callback
      )
    })
  })
}
