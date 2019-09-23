const Settings = require('settings-sharelatex')
const Async = require('async')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['users'])

const indexKeys = { 'tokens.readAndWritePrefix': 1 }
const indexOpts = {
  unique: true,
  partialFilterExpression: {
    'tokens.readAndWritePrefix': { $exists: true }
  },
  background: true
}

// Index on Prefix
const addReadAndWritePrefixIndex = (db, callback) => {
  db.projects.ensureIndex(indexKeys, indexOpts, callback)
}

const removeReadAndWritePrefixIndex = (db, callback) => {
  db.projects.dropIndex(indexKeys, callback)
}

// Extract prefix data
const extractPrefix = (db, callback) => {
  db.projects.find(
    {
      'tokens.readAndWrite': { $exists: true },
      'tokens.readAndWritePrefix': { $exists: false }
    },
    { tokens: 1 },
    (err, projects) => {
      if (err) {
        return callback(err)
      }
      console.log(`>> Updating ${projects.length} projects`)
      Async.eachLimit(
        projects,
        5,
        (project, cb) => {
          const rwToken = project.tokens.readAndWrite
          const prefixMatch = rwToken.match(/^(\d+).*$/)
          if (!prefixMatch) {
            const err = new Error(
              `no prefix on token: ${project._id}, ${rwToken}`
            )
            console.log(`>> Error, ${err.message}`)
            return cb(err)
          }
          db.projects.update(
            { _id: project._id },
            { $set: { 'tokens.readAndWritePrefix': prefixMatch[1] } },
            cb
          )
        },
        err => {
          if (err) {
            return callback(err)
          }
          console.log('>> done')
          callback()
        }
      )
    }
  )
}

const erasePrefix = (db, callback) => {
  db.projects.update({$unset: 'tokens.readAndWritePrefix'}, callback)
}


// Migrations

exports.migrate = (client, done) => {
  console.log(`>> Adding index to projects: ${JSON.stringify(indexKeys)}, with options: ${JSON.stringify(indexOpts)}`)
  addReadAndWritePrefixIndex(db, (err) => {
    if(err) {
      console.log(">> Error while adding index")
      return done(err)
    }
    console.log(">> Extracting tokens.readAndWritePrefix field for existing projects")
    extractPrefix(db, (err) => {
      if(err) {
        console.log(">> Error while extracting prefix data")
        return done(err)
      }
      done()
    })
  })
}

exports.rollback = (client, done) => {
  console.log(`>> Dropping index on projects: ${JSON.stringify(indexKeys)}`)
  removeReadAndWritePrefixIndex(db, (err) => {
    if(err) {
      console.log(">> Error while dropping index")
      return done(err)
    }
    console.log(">> Erasing tokens.readAndWritePrefix field for existing projects")
    erasePrefix(db, (err) => {
      if(err) {
        console.log(">> Error while erasing prefix data")
        return done(err)
      }
      done()
    })
  })
}
