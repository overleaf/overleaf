const { Joi: CelebrateJoi, celebrate, errors } = require('celebrate')
const { ObjectId } = require('mongodb-legacy')

const objectIdValidator = {
  type: 'objectId',
  base: CelebrateJoi.any(),
  messages: {
    'objectId.invalid': 'needs to be a valid ObjectId',
  },
  coerce(value) {
    return {
      value: typeof value === typeof ObjectId ? value : new ObjectId(value),
    }
  },
  prepare(value, helpers) {
    if (!ObjectId.isValid(value)) {
      return {
        errors: helpers.error('objectId.invalid'),
      }
    }
  },
}

const Joi = CelebrateJoi.extend(objectIdValidator)
const errorMiddleware = errors()

module.exports = { Joi, validate, errorMiddleware }

/**
 * Validation middleware
 */
function validate(schema) {
  return celebrate(schema, { allowUnknown: true })
}
