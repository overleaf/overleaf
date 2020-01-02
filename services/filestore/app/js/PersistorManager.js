const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

module.exports = (function() {
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
      return require('./AWSSDKPersistorManager')
    case 's3':
      return require('./S3PersistorManager')
    case 'fs':
      return require('./FSPersistorManager')
    default:
      throw new Error(
        `unknown filestore backend: ${settings.filestore.backend}`
      )
  }
})()
