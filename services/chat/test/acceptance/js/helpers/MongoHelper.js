import { exec } from 'node:child_process'
import { promisify } from 'node:util'

before('run migrations', async function () {
  this.timeout(60_000)

  await promisify(exec)(
    `cd ../../tools/migrations && npm run migrations -- migrate -t server-ce`
  )
})
