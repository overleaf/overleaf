const { exec } = require('child_process')
const { waitForDb, db } = require('../../../../app/src/infrastructure/mongodb')

module.exports = {
  initialize() {
    before(waitForDb)

    before(function(done) {
      exec('bin/east migrate', (error, stdout, stderr) => {
        console.log(stdout)
        console.error(stderr)
        if (error) {
          throw error
        }
        done()
      })
    })

    afterEach(async function() {
      return Promise.all(
        Object.values(db).map(collection => collection.deleteMany({}))
      )
    })
  }
}
