import mongoose from '../infrastructure/Mongoose.mjs'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import request from 'request'
const { Schema } = mongoose
const { ObjectId } = Schema

export const PublisherSchema = new Schema(
  {
    slug: { type: String, required: true },
    managerIds: [{ type: ObjectId, ref: 'User' }],
  },
  { minimize: false }
)

// fetch publisher's (brand on v1) data from v1 API. Errors are ignored
PublisherSchema.method('fetchV1Data', function (callback) {
  request(
    {
      baseUrl: settings.apis.v1.url,
      url: `/api/v2/brands/${this.slug}`,
      method: 'GET',
      auth: {
        user: settings.apis.v1.user,
        pass: settings.apis.v1.pass,
        sendImmediately: true,
      },
      timeout: settings.apis.v1.timeout,
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
      callback(null, this)
    }
  )
})

export const Publisher = mongoose.model('Publisher', PublisherSchema)
