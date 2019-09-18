const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['users'])
const async = require('async')

const handleExit = () => console.log('Got signal.  Shutting down.')
process.on('SIGINT', handleExit)
process.on('SIGHUP', handleExit)

const initUserEmailsAttribute = (user, callback) => {
  const update = {
    $set: {
      emails: [
        {
          email: user.email,
          createdAt: new Date()
        }
      ]
    }
  }
  db.users.update({ _id: user._id }, update, callback)
}

const updateAllUsersEmailsAttribute = (users, callback) => {
  console.log(`updating ${users.length} users`)
  async.eachSeries(users, initUserEmailsAttribute, callback)
}

exports.migrate = (client, done) =>
  db.users.find(
    { emails: { $exists: false } },
    { email: 1 },
    (error, users) => {
      if (error) {
        callback(error)
      } else {
        updateAllUsersEmailsAttribute(users, done)
      }
    }
  )

exports.rollback = (client, done) => {
  const update = {
    $unset: {
      emails: 1
    }
  }
  db.users.update({ emails: { $exists: true } }, update, done)
}
