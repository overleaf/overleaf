const { execFile } = require('child_process')
const {
  waitForDb,
  db,
  dropTestDatabase,
} = require('../../../../app/src/infrastructure/mongodb')
const Settings = require('@overleaf/settings')

const DEFAULT_ENV = 'saas'

module.exports = {
  initialize() {
    before('wait for db', waitForDb)
    if (process.env.CLEANUP_MONGO === 'true') {
      before('drop test database', dropTestDatabase)
    }

    before('run migrations', function (done) {
      const args = [
        'run',
        'migrations',
        '--',
        'migrate',
        '-t',
        Settings.env || DEFAULT_ENV,
      ]
      execFile('npm', args, (error, stdout, stderr) => {
        if (error) {
          throw error
        }
        done()
      })
    })

    afterEach('purge mongo data', async function () {
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
