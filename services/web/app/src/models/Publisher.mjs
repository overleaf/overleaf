import mongoose from '../infrastructure/Mongoose.mjs'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { fetchJson } from '@overleaf/fetch-utils'
import { callbackify } from '@overleaf/promise-utils'
const { Schema } = mongoose
const { ObjectId } = Schema

export const PublisherSchema = new Schema(
  {
    slug: { type: String, required: true },
    managerIds: [{ type: ObjectId, ref: 'User' }],
  },
  { minimize: false }
)

async function fetchV1DataPromise() {
  const url = `${settings.apis.v1.url}/api/v2/brands/${this.slug}`
  try {
    const parsedBody = await fetchJson(url, {
      basicAuth: {
        user: settings.apis.v1.user,
        pass: settings.apis.v1.pass,
      },
      signal: AbortSignal.timeout(settings.apis.v1.timeout),
    })

    this.name = parsedBody?.name
    this.partner = parsedBody?.partner
    return this
  } catch (error) {
    // log error and carry on without v1 data
    logger.err(
      { model: 'Publisher', slug: this.slug, error },
      '[fetchV1DataError]'
    )
  }
  return this
}

PublisherSchema.method('fetchV1DataPromise', fetchV1DataPromise)

PublisherSchema.method('fetchV1Data', callbackify(fetchV1DataPromise))

export const Publisher = mongoose.model('Publisher', PublisherSchema)
