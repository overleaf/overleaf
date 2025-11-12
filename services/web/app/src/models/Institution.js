const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose
const { ObjectId } = Schema
const settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const { promisify } = require('@overleaf/promise-utils')
const { fetchJson } = require('@overleaf/fetch-utils')

const InstitutionSchema = new Schema(
  {
    v1Id: { type: Number, required: true },
    managerIds: [{ type: ObjectId, ref: 'User' }],
    metricsEmail: {
      optedOutUserIds: [{ type: ObjectId, ref: 'User' }],
      lastSent: { type: Date },
    },
    groupPolicy: { type: ObjectId, ref: 'GroupPolicy' },
  },
  { minimize: false }
)

// fetch institution's data from v1 API. Errors are ignored
InstitutionSchema.method('fetchV1Data', async function (callback) {
  const url = `${settings.apis.v1.url}/universities/list/${this.v1Id}`
  try {
    const parsedBody = await fetchJson(url)
    this.name = parsedBody != null ? parsedBody.name : undefined
    this.countryCode = parsedBody != null ? parsedBody.country_code : undefined
    this.departments = parsedBody != null ? parsedBody.departments : undefined
    this.portalSlug = parsedBody != null ? parsedBody.portal_slug : undefined
    this.enterpriseCommons =
      parsedBody != null ? parsedBody.enterprise_commons : undefined
  } catch (error) {
    // log error and carry on without v1 data
    logger.err(
      { model: 'Institution', v1Id: this.v1Id, error },
      '[fetchV1DataError]'
    )
  }
  callback(null, this)
})

InstitutionSchema.method(
  'fetchV1DataPromise',
  promisify(InstitutionSchema.methods.fetchV1Data)
)

exports.Institution = mongoose.model('Institution', InstitutionSchema)
exports.InstitutionSchema = InstitutionSchema
