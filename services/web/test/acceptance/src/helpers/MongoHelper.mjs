import { execFile } from 'node:child_process'
import {
  connectionPromise,
  cleanupTestDatabase,
  dropTestDatabase,
} from '../../../../app/src/infrastructure/mongodb.js'
import Settings from '@overleaf/settings'

const DEFAULT_ENV = 'saas'

export default {
  initialize() {
    before('wait for db', async function () {
      await connectionPromise
    })
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

    afterEach('purge mongo data', cleanupTestDatabase)
  },
}
