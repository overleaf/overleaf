const { isZodErrorLike, fromError } = require('zod-validation-error')
/**
 * @typedef {import('express').ErrorRequestHandler} ErrorRequestHandler
 */

const handleValidationError = [
  /** @type {ErrorRequestHandler} */
  (err, req, res, next) => {
    if (!isZodErrorLike(err)) {
      return next(err)
    }

    res.status(400).json({ ...fromError(err), statusCode: 400 })
  },
]

module.exports = { handleValidationError }
