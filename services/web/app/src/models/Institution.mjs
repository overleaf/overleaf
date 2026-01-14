import mongoose from '../infrastructure/Mongoose.mjs'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { callbackify } from '@overleaf/promise-utils'
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
async function fetchV1DataPromise() {
  const url = `${settings.apis.v1.url}/universities/list/${this.v1Id}`
  try {
    const parsedBody = await fetchJson(url)
    this.name = parsedBody?.name
    this.countryCode = parsedBody?.country_code
    this.departments = parsedBody?.departments
    this.portalSlug = parsedBody?.portal_slug
    this.enterpriseCommons = parsedBody?.enterprise_commons
  } catch (error) {
    // log error and carry on without v1 data
    logger.err(
      { model: 'Institution', v1Id: this.v1Id, error },
      '[fetchV1DataError]'
    )
  }
  return this
}

InstitutionSchema.method('fetchV1DataPromise', fetchV1DataPromise)

InstitutionSchema.method('fetchV1Data', callbackify(fetchV1DataPromise))

export const Institution = mongoose.model('Institution', InstitutionSchema)
