/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

mongoose.connect(
  Settings.mongo.url,
  {
    server: { poolSize: 10 },
    config: { autoIndex: false }
  }
)

mongoose.connection.on('connected', () =>
  logger.log({ url: Settings.mongo.url }, 'mongoose default connection open')
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

module.exports = mongoose
