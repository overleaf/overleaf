const _ = require('lodash')
const config = require('config')
const metrics = require('./metrics')
const objectPersistor = require('@overleaf/object-persistor')

const persistorConfig = _.cloneDeep(config.get('persistor'))

function convertKey(key, convertFn) {
  if (_.has(persistorConfig, key)) {
    _.update(persistorConfig, key, convertFn)
  }
}

convertKey('s3.signedUrlExpiryInMs', s => parseInt(s, 10))
convertKey('s3.httpOptions.timeout', s => parseInt(s, 10))
convertKey('s3.maxRetries', s => parseInt(s, 10))
convertKey('s3.pathStyle', s => s === 'true')
convertKey('gcs.unlockBeforeDelete', s => s === 'true')
convertKey('gcs.unsignedUrls', s => s === 'true')
convertKey('gcs.signedUrlExpiryInMs', s => parseInt(s, 10))
convertKey('gcs.deleteConcurrency', s => parseInt(s, 10))
convertKey('gcs.retryOptions.maxRetries', s => parseInt(s, 10))
convertKey('fallback.buckets', s => JSON.parse(s || '{}'))

persistorConfig.Metrics = metrics

module.exports = objectPersistor(persistorConfig)
