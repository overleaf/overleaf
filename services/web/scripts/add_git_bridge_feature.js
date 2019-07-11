const { db } = require('../app/src/infrastructure/mongojs')
const logger = require('logger-sharelatex')
logger.logger.level('error')

logger.log({}, 'Updating users in mongo')

db.users.update(
  {
    'features.github': true
  },
  {
    $set: { 'features.gitBridge': true }
  },
  function(err, result) {
    if (err) {
      logger.err({ err: err, result: result }, 'Error updating users in mongo')
      return
    }
    logger.log(
      { result: result },
      'Updated users who have github to have gitBridge too'
    )
    process.exit(0)
  }
)
