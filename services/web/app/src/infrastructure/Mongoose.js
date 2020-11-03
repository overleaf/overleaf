const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

if (
  typeof global.beforeEach === 'function' &&
  process.argv.join(' ').match(/unit/)
) {
  throw new Error(
    'It looks like unit tests are running, but you are connecting to Mongo. Missing a stub?'
  )
}

const connectionPromise = mongoose.connect(
  Settings.mongo.url,
  Object.assign(
    {
      // mongoose specific config
      config: { autoIndex: false },
      // mongoose defaults to false, native driver defaults to true
      useNewUrlParser: true,
      // use the equivalent `findOneAndUpdate` methods of the native driver
      useFindAndModify: false
    },
    Settings.mongo.options
  )
)

mongoose.connection.on('connected', () =>
  logger.log('mongoose default connection open')
)

mongoose.connection.on('error', err =>
  logger.err({ err }, 'mongoose error on default connection')
)

mongoose.connection.on('disconnected', () =>
  logger.log('mongoose default connection disconnected')
)

if (process.env.MONGOOSE_DEBUG) {
  mongoose.set('debug', (collectionName, method, query, doc) =>
    logger.debug({ collectionName, method, query, doc }, 'mongoose debug')
  )
}

mongoose.plugin(schema => {
  schema.options.usePushEach = true
})

mongoose.Promise = global.Promise

async function getNativeDb() {
  const mongooseInstance = await connectionPromise
  return mongooseInstance.connection.db
}

mongoose.getNativeDb = getNativeDb

module.exports = mongoose
