const mongojs = require('../../app/src/infrastructure/mongojs')
const { db, ObjectId } = mongojs
const Async = require('async')

const projectIds = [
  // put ids here
]

Async.eachLimit(
  projectIds,
  5,
  (projectId, cb) => {
    db.projects.update(
      { _id: ObjectId(projectId) },
      {
        $unset: { tokens: 1 },
        $set: { publicAccesLevel: 'private' }
      },
      err => {
        if (err) return cb(err)
        console.log(`Deactivated tokens for ${projectId}`)
        cb()
      }
    )
  },
  err => {
    if (err) throw err
    console.log('>> Done')
    process.exit(0)
  }
)
