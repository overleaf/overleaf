const HttpErrors = require('@overleaf/o-error/http')
const bodyParser = require('body-parser')

const convertToHTTPError = error => {
  if (!error.statusCode || error.statusCode < 400 || error.statusCode >= 600) {
    // cannot be converted to a HttpError
    return error
  }

  return new HttpErrors.HttpError({
    message: error.message,
    statusCode: error.statusCode
  }).withCause(error)
}

// Wraps a parser and attempt to wrap its error (if any) into a HTTPError so the
// response code is forwarded to the client
const wrapBodyParser = method => opts => {
  const middleware = bodyParser[method](opts)
  return (req, res, next) => {
    middleware(req, res, nextArg => {
      if (nextArg instanceof Error) {
        return next(convertToHTTPError(nextArg))
      }
      next(nextArg)
    })
  }
}

module.exports = {
  urlencoded: wrapBodyParser('urlencoded'),
  json: wrapBodyParser('json')
}
