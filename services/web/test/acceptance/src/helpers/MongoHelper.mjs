import { exec } from 'node:child_process'
import {
  connectionPromise,
  cleanupTestDatabase,
  dropTestDatabase,
} from '../../../../app/src/infrastructure/mongodb.mjs'
import Settings from '@overleaf/settings'
import { promisify } from 'node:util'

const DEFAULT_ENV = 'saas'

export default {
  initialize() {
    before('wait for db', async function () {
      await connectionPromise
    })
    if (process.env.CLEANUP_MONGO === 'true') {
      before('drop test database', dropTestDatabase)
    }

    before('run migrations', async function () {
      this.timeout(60_000)

      await promisify(exec)(
        `cd ../../tools/migrations && npm run migrations -- migrate -t ${Settings.env || DEFAULT_ENV}`
      )
    })

    afterEach('purge mongo data', cleanupTestDatabase)
  },
}
