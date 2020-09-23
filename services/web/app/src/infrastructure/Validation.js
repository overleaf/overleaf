const { Joi: CelebrateJoi, celebrate, errors } = require('celebrate')
const { ObjectId } = require('mongodb')

const objectIdValidator = {
  name: 'objectId',
  language: {
    invalid: 'needs to be a valid ObjectId'
  },
  pre(value, state, options) {
    if (!ObjectId.isValid(value)) {
      return this.createError('objectId.invalid', { value }, state, options)
    }

    if (options.convert) {
      return new ObjectId(value)
    }

    return value
  }
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
