const { OauthApplication } = require('../app/src/models/OauthApplication')
const parseArgs = require('minimist')
const OError = require('@overleaf/o-error')
const { waitForDb } = require('../app/src/infrastructure/mongodb')

async function _removeOauthApplication(appId) {
  if (!appId) {
    throw new OError('No app id supplied')
  }
  console.log('Waiting for db...')
  await waitForDb()
  console.log(`Removing oauthApplication with id=${appId}`)
  const result = await OauthApplication.deleteOne({ id: appId })
  console.log('Result', result)
}

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    string: ['id'],
    unknown: function (arg) {
      console.error('unrecognised argument', arg)
      process.exit(1)
    },
  })
  const appId = argv.id
  await _removeOauthApplication(appId)
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('Done')
      process.exit(0)
    })
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
}
