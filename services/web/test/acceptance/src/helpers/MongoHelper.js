const { exec } = require('child_process')
const { waitForDb, db } = require('../../../../app/src/infrastructure/mongodb')

module.exports = {
  initialize() {
    before(waitForDb)

    before(function (done) {
      exec('bin/east migrate', (error, stdout, stderr) => {
        if (error) {
          throw error
        }
        done()
      })
    })

    afterEach(async function () {
      return Promise.all(
        Object.values(db).map(async collection => {
          if (collection === db.migrations) {
            // Do not clear the collection for tracking migrations.
            return
          }
          return collection.deleteMany({})
        })
      )
    })
  },
}
