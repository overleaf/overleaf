const bodyParser = require('body-parser')
const HttpErrorHandler = require('../Features/Errors/HttpErrorHandler')

function isBodyParserError(nextArg) {
  if (nextArg instanceof Error) {
    return (
      nextArg.statusCode &&
      nextArg.statusCode >= 400 &&
      nextArg.statusCode < 600
    )
  }
  return false
}

const wrapBodyParser = method => opts => {
  const middleware = bodyParser[method](opts)
  return function bodyParser(req, res, next) {
    middleware(req, res, nextArg => {
      if (isBodyParserError(nextArg)) {
        return HttpErrorHandler.handleErrorByStatusCode(
          req,
          res,
          nextArg,
          nextArg.statusCode
        )
      }
      next(nextArg)
    })
  }
}

module.exports = {
  urlencoded: wrapBodyParser('urlencoded'),
  json: wrapBodyParser('json'),
}
