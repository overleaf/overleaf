const { Joi: CelebrateJoi, celebrate, errors } = require('celebrate')
const JoiObjectId = require('joi-mongodb-objectid')

const Joi = CelebrateJoi.extend(JoiObjectId)
const errorMiddleware = errors()

module.exports = { Joi, validate, errorMiddleware }

/**
 * Validation middleware
 */
function validate(schema) {
  return celebrate(schema, { allowUnknown: true })
}
