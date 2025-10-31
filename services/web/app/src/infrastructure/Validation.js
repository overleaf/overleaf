// @ts-check

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

const errorMiddleware = [
  /** @type {ErrorRequestHandler} */
  (err, req, res, next) => {
    if (!isZodErrorLike(err)) {
      return next(err)
    }

    res.status(400).json({ ...fromError(err), statusCode: 400 })
  },
]

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
  errorMiddleware,
  validateReq: validateReqWeb,
  z,
  zz,
}
