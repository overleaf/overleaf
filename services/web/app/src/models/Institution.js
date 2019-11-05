/* eslint-disable
    handle-callback-err
*/
const mongoose = require('mongoose')
const { Schema } = mongoose
const { ObjectId } = Schema
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const request = require('request')

const InstitutionSchema = new Schema({
  v1Id: { type: Number, required: true },
  managerIds: [{ type: ObjectId, ref: 'User' }],
  metricsEmail: {
    optedOutUserIds: [{ type: ObjectId, ref: 'User' }],
    lastSent: { type: Date }
  }
})

// fetch institution's data from v1 API. Errors are ignored
InstitutionSchema.method('fetchV1Data', function(callback) {
  if (callback == null) {
    callback = function(error, institution) {}
  }
  const url = `${settings.apis.v1.url}/universities/list/${this.v1Id}`
  return request.get(url, (error, response, body) => {
    let parsedBody
    try {
      parsedBody = JSON.parse(body)
    } catch (error1) {
      // log error and carry on without v1 data
      error = error1
      logger.err(
        { model: 'Institution', v1Id: this.v1Id, error },
        '[fetchV1DataError]'
      )
    }
    this.name = parsedBody != null ? parsedBody.name : undefined
    this.countryCode = parsedBody != null ? parsedBody.country_code : undefined
    this.departments = parsedBody != null ? parsedBody.departments : undefined
    this.portalSlug = parsedBody != null ? parsedBody.portal_slug : undefined
    return callback(null, this)
  })
})

const conn = mongoose.createConnection(settings.mongo.url, {
  server: { poolSize: settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const Institution = conn.model('Institution', InstitutionSchema)
exports.Institution = Institution
exports.InstitutionSchema = InstitutionSchema
