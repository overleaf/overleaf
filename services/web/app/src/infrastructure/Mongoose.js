const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

const POOL_SIZE = Settings.mongo.poolSize

mongoose.connect(
  Settings.mongo.url,
  {
    poolSize: POOL_SIZE,
    config: { autoIndex: false },
    useMongoClient: true,
    appname: 'web'
  }
)

mongoose.connection.on('connected', () =>
  logger.log(
    {
      url: Settings.mongo.url,
      poolSize: POOL_SIZE
    },
    'mongoose default connection open'
  )
)

mongoose.connection.on('error', err =>
  logger.err({ err }, 'mongoose error on default connection')
)

mongoose.connection.on('disconnected', () =>
  logger.log('mongoose default connection disconnected')
)

if (process.env.MONGOOSE_DEBUG) {
  mongoose.set('debug', (collectionName, method, query, doc) =>
    logger.debug('mongoose debug', { collectionName, method, query, doc })
  )
}

mongoose.plugin(schema => {
  schema.options.usePushEach = true
})

module.exports = mongoose
