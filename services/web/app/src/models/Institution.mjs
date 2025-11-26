import mongoose from '../infrastructure/Mongoose.mjs'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { promisify } from '@overleaf/promise-utils'
import { fetchJson } from '@overleaf/fetch-utils'
const { Schema } = mongoose
const { ObjectId } = Schema

export const InstitutionSchema = new Schema(
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

export const Institution = mongoose.model('Institution', InstitutionSchema)
