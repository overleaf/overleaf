// @ts-check

const { Joi: CelebrateJoi, celebrate, errors } = require('celebrate')
const { ObjectId } = require('mongodb-legacy')
const { NotFoundError } = require('../Features/Errors/Errors')
const {
  validateReq,
  z,
  zz,
  ParamsError,
} = require('@overleaf/validation-tools')
const { isZodErrorLike, fromError } = require('zod-validation-error')

/**
 * @typedef {import('express').ErrorRequestHandler} ErrorRequestHandler
 */

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
const errorMiddleware = [
  errors(),
  /** @type {ErrorRequestHandler} */
  (err, req, res, next) => {
    if (!isZodErrorLike(err)) {
      return next(err)
    }

    res.status(400).json({ ...fromError(err), statusCode: 400 })
  },
]

/**
 * Validation middleware
 * @deprecated Please use Zod schemas and `validateReq` instead
 */
function validate(schema) {
  return celebrate(schema, { allowUnknown: true })
}

const validateReqWeb = (req, schema) => {
  try {
    return validateReq(req, schema)
  } catch (err) {
    if (err instanceof ParamsError) {
      // convert into a NotFoundError that web understands
      throw new NotFoundError('Not found').withCause(err)
    }
    throw err
  }
}

module.exports = {
  Joi,
  validate,
  errorMiddleware,
  validateReq: validateReqWeb,
  z,
  zz,
}
