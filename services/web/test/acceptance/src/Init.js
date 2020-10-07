const App = require('../../../app.js')
const { exec } = require('child_process')
const { waitForDb, db } = require('../../../app/src/infrastructure/mongodb')

require('logger-sharelatex').logger.level('error')

before(waitForDb)

before(function(done) {
  exec('bin/east migrate', (error, stdout, stderr) => {
    console.log(stdout)
    console.error(stderr)
    if (error) {
      throw error
    }
    App.listen(3000, 'localhost', done)
  })
})

afterEach(async function() {
  return Promise.all(
    Object.values(db).map(collection => collection.deleteMany({}))
  )
})
