const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['tokens'])
const async = require('async')

exports.migrate = (client, done) => {
  console.log(`>> Updating 'data.email' to lower case in tokens`)

  db.tokens.find({}, { 'data.email': 1 }, (err, tokens) => {
    if (err) {
      return done(err)
    }

    async.eachSeries(
      tokens,
      (token, callback) => {
        db.tokens.update(
          { _id: token._id },
          { $set: { 'data.email': token.data.email.toLowerCase() } },
          callback
        )
      },
      done
    )
  })
}

exports.rollback = (client, done) => done()
