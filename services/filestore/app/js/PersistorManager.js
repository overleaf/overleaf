const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

logger.log(
  {
    backend: settings.filestore.backend
  },
  'Loading backend'
)
if (!settings.filestore.backend) {
  throw new Error('no backend specified - config incomplete')
}

switch (settings.filestore.backend) {
  case 'aws-sdk':
  case 's3':
    module.exports = require('./S3Persistor')
    break
  case 'fs':
    module.exports = require('./FSPersistor')
    break
  default:
    throw new Error(`unknown filestore backend: ${settings.filestore.backend}`)
}
