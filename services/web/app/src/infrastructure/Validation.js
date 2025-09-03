// @ts-check

const { Joi: CelebrateJoi, celebrate, errors } = require('celebrate')
const { ObjectId } = require('mongodb-legacy')
const { NotFoundError } = require('../Features/Errors/Errors')
const { z } = require('zod')

/**
 * @import { ZodType } from 'zod'
 * @import { Request } from 'express'
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
const errorMiddleware = errors()

/**
 * Validation middleware
 */
function validate(schema) {
  return celebrate(schema, { allowUnknown: true })
}

const zz = {
  objectId: () =>
    z.string().refine(ObjectId.isValid, { message: 'invalid Mongo ObjectId' }),
  coercedObjectId: () =>
    z
      .string()
      .refine(ObjectId.isValid, { message: 'invalid Mongo ObjectId' })
      .transform(val => new ObjectId(val)),
}

/**
 * Validate a request against a zod schema
 *
 * @template T
 * @param {Request} req
 * @param {ZodType<T>} schema
 * @return {T}
 */
function validateReq(req, schema) {
  const parsed = schema.safeParse(req)
  if (parsed.success) {
    return parsed.data
  } else if (parsed.error.issues.some(issue => issue.path[0] === 'params')) {
    // Parts of the URL path failed to validate; throw a 404 rather than a 400
    throw new NotFoundError('Not found').withCause(parsed.error)
  } else {
    throw parsed.error
  }
}

module.exports = { Joi, validate, errorMiddleware, validateReq, z, zz }
