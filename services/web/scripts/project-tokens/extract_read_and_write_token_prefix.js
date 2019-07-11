const mongojs = require('../../app/src/infrastructure/mongojs')
const { db } = mongojs
const Async = require('async')

db.projects.find(
  {
    'tokens.readAndWrite': { $exists: true },
    'tokens.readAndWritePrefix': { $exists: false }
  },
  { tokens: 1 },
  (err, projects) => {
    if (err) {
      throw err
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
          throw err
        }
        console.log('>> done')
        process.exit(0)
      }
    )
  }
)
