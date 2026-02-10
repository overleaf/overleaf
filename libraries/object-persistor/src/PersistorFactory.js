const Logger = require('@overleaf/logger')
const { SettingsError } = require('./Errors')

function getPersistor(backend, settings) {
  switch (backend) {
    case 'aws-sdk':
    case 's3': {
      const { S3Persistor } = require('./S3Persistor')
      return new S3Persistor(settings.s3)
    }
    case 's3SSEC': {
      const {
        PerProjectEncryptedS3Persistor,
      } = require('./PerProjectEncryptedS3Persistor')
      return new PerProjectEncryptedS3Persistor(settings.s3SSEC)
    }
    case 'fs': {
      const FSPersistor = require('./FSPersistor')
      return new FSPersistor({
        useSubdirectories: settings.useSubdirectories,
        paths: settings.paths,
      })
    }
    case 'gcs': {
      const GcsPersistor = require('./GcsPersistor')
      return new GcsPersistor(settings.gcs)
    }
    default:
      throw new SettingsError('unknown backend', { backend })
  }
}

module.exports = function create(settings) {
  Logger.info(
    {
      backend: settings.backend,
      fallback: settings.fallback && settings.fallback.backend,
    },
    'Loading backend'
  )
  if (!settings.backend) {
    throw new SettingsError('no backend specified - config incomplete')
  }

  let persistor = getPersistor(settings.backend, settings)

  if (settings.fallback && settings.fallback.backend) {
    const primary = persistor
    const fallback = getPersistor(settings.fallback.backend, settings)
    const MigrationPersistor = require('./MigrationPersistor')
    persistor = new MigrationPersistor(primary, fallback, settings.fallback)
  }

  return persistor
}
