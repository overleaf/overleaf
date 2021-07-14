const { waitForDb } = require('../../../app/src/infrastructure/mongodb')

waitForDb()
  .then(() => {
    console.error('Mongodb is up.')
    process.exit(0)
  })
  .catch(err => {
    console.error('Cannot connect to mongodb.')
    console.error(err)
    process.exit(1)
  })
