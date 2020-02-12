const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

logger.log(
  {
    backend: settings.filestore.backend,
    fallback: settings.filestore.fallback && settings.filestore.fallback.backend
  },
  'Loading backend'
)
if (!settings.filestore.backend) {
  throw new Error('no backend specified - config incomplete')
}

function getPersistor(backend) {
  switch (backend) {
    case 'aws-sdk':
    case 's3':
      return require('./S3Persistor')
    case 'fs':
      return require('./FSPersistor')
    case 'gcs':
      return require('./GcsPersistor')
    default:
      throw new Error(`unknown filestore backend: ${backend}`)
  }
}

let persistor = getPersistor(settings.filestore.backend)

if (settings.filestore.fallback && settings.filestore.fallback.backend) {
  const migrationPersistor = require('./MigrationPersistor')
  persistor = migrationPersistor(
    persistor,
    getPersistor(settings.filestore.fallback.backend)
  )
}

module.exports = persistor
