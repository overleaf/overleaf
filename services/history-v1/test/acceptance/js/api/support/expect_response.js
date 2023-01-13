'use strict'

const { expect } = require('chai')
const HTTPStatus = require('http-status')

function expectStatus(err, expected) {
  const httpStatus = err.status || err.statusCode
  if (httpStatus === undefined) {
    throw err
  } else {
    expect(httpStatus).to.equal(expected)
  }
}

async function expectHttpError(promise, expectedStatusCode) {
  try {
    await promise
  } catch (err) {
    const statusCode = err.status || err.statusCode
    if (statusCode === undefined) {
      throw err
    } else {
      expect(statusCode).to.equal(expectedStatusCode)
      return
    }
  }
  expect.fail('expected HTTP request to return with an error response')
}

exports.expectHttpError = expectHttpError
exports.notFound = function (err) {
  expectStatus(err, HTTPStatus.NOT_FOUND)
}

exports.unprocessableEntity = function (err) {
  expectStatus(err, HTTPStatus.UNPROCESSABLE_ENTITY)
}

exports.conflict = function (err) {
  expectStatus(err, HTTPStatus.CONFLICT)
}

exports.unauthorized = function (err) {
  expectStatus(err, HTTPStatus.UNAUTHORIZED)
}

exports.forbidden = function (err) {
  expectStatus(err, HTTPStatus.FORBIDDEN)
}

exports.requestEntityTooLarge = function (err) {
  expectStatus(err, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
}
