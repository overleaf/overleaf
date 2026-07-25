import { beforeAll } from 'vitest'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

beforeAll(async function () {
  await promisify(exec)(
    `cd ../../tools/migrations && yarn run migrations migrate -t 'server-ce & !nonblocking'`
  )
}, 60_000)
