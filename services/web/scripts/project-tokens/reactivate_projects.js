const ProjectDetailsHandler = require('../../app/src/Features/Project/ProjectDetailsHandler')
const Async = require('async')

const projectIds = [
  // put ids here
]

Async.eachLimit(
  projectIds,
  5,
  (projectId, cb) => {
    ProjectDetailsHandler.setPublicAccessLevel(projectId, 'tokenBased', err => {
      if (err) {
        return cb(err)
      }
      console.log(
        `>> Set public-access-level to tokenBased for project ${projectId}`
      )
      ProjectDetailsHandler.ensureTokensArePresent(projectId, (err, tokens) => {
        if (err) {
          return cb(err)
        }
        console.log(
          `>> Re-generated tokens for project ${projectId}, ${JSON.stringify(
            tokens
          )}`
        )
        cb()
      })
    })
  },
  err => {
    if (err) {
      throw err
    }
    console.log('>> Done')
    process.exit(0)
  }
)
