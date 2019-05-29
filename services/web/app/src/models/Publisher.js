/* eslint-disable
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const mongoose = require('mongoose')
const { Schema } = mongoose
const { ObjectId } = Schema
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const request = require('request')

const PublisherSchema = new Schema({
  slug: { type: String, required: true },
  managerIds: [{ type: ObjectId, ref: 'User' }]
})

// fetch publisher's (brand on v1) data from v1 API. Errors are ignored
PublisherSchema.method('fetchV1Data', function(callback) {
  if (callback == null) {
    callback = function(error, publisher) {}
  }
  return request(
    {
      baseUrl: settings.apis.v1.url,
      url: `/api/v2/brands/${this.slug}`,
      method: 'GET',
      auth: {
        user: settings.apis.v1.user,
        pass: settings.apis.v1.pass,
        sendImmediately: true
      }
    },
    (error, response, body) => {
      let parsedBody
      try {
        parsedBody = JSON.parse(body)
      } catch (error1) {
        // log error and carry on without v1 data
        error = error1
        logger.err(
          { model: 'Publisher', slug: this.slug, error },
          '[fetchV1DataError]'
        )
      }
      this.name = parsedBody != null ? parsedBody.name : undefined
      this.partner = parsedBody != null ? parsedBody.partner : undefined
      return callback(null, this)
    }
  )
})

const conn = mongoose.createConnection(settings.mongo.url, {
  server: { poolSize: settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const Publisher = conn.model('Publisher', PublisherSchema)
exports.Publisher = Publisher
exports.PublisherSchema = PublisherSchema
