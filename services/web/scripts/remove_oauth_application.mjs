import { OauthApplication } from '../app/src/models/OauthApplication.js'
import parseArgs from 'minimist'
import OError from '@overleaf/o-error'

async function _removeOauthApplication(appId) {
  if (!appId) {
    throw new OError('No app id supplied')
  }
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

try {
  await main()
  console.log('Done')
  process.exit(0)
} catch (error) {
  console.error(error)
  process.exit(1)
}
