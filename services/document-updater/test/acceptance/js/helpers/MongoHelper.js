const { exec } = require('node:child_process')
const { promisify } = require('node:util')

before('run migrations', async function () {
  this.timeout(60_000)

  await promisify(exec)(
    `cd ../../tools/migrations && yarn run migrations migrate -t 'server-ce & !nonblocking'`
  )
})
