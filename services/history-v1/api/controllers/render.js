'use strict'

const HTTPStatus = require('http-status')

function makeErrorRenderer(status) {
  return (res, message) => {
    res.status(status).json({ message: message || HTTPStatus[status] })
  }
}

module.exports = {
  badRequest: makeErrorRenderer(HTTPStatus.BAD_REQUEST),
  notFound: makeErrorRenderer(HTTPStatus.NOT_FOUND),
  unprocessableEntity: makeErrorRenderer(HTTPStatus.UNPROCESSABLE_ENTITY),
  conflict: makeErrorRenderer(HTTPStatus.CONFLICT),
  requestEntityTooLarge: makeErrorRenderer(HTTPStatus.REQUEST_ENTITY_TOO_LARGE),
}
