const { isZodErrorLike, fromError } = require('zod-validation-error')

function createHandleValidationError(statusCode = 400) {
  return [
    (err, req, res, next) => {
      if (!isZodErrorLike(err)) {
        return next(err)
      }

      res.status(statusCode).json({ ...fromError(err), statusCode })
    },
  ]
}

const handleValidationError = createHandleValidationError(400)

module.exports = { handleValidationError, createHandleValidationError }
