import request from 'request'

import settings from '@overleaf/settings'
import Errors from '../Errors/Errors.js'
import { promisifyMultiResult } from '@overleaf/promise-utils'
import OError from '@overleaf/o-error'

// TODO: check what happens when these settings aren't defined
const DEFAULT_V1_PARAMS = {
  baseUrl: settings.apis.v1.url,
  auth: {
    user: settings.apis.v1.user,
    pass: settings.apis.v1.pass,
  },
  json: true,
  timeout: settings.apis.v1.timeout,
}

const v1Request = request.defaults(DEFAULT_V1_PARAMS)

function makeRequest(options, callback) {
  if (!callback) {
    return request(options)
  }
  v1Request(options, (error, response, body) =>
    _responseHandler(options, error, response, body, callback)
  )
}

function _responseHandler(options, error, response, body, callback) {
  const { expectedStatusCodes } = options
  if (error) {
    return callback(
      new Errors.V1ConnectionError('error from V1 API').withCause(error)
    )
  }
  if (response && response.statusCode >= 500) {
    return callback(
      new Errors.V1ConnectionError({
        message: 'error from V1 API',
        info: { status: response.statusCode, body },
      })
    )
  }
  if (
    (response && response.statusCode >= 200 && response.statusCode < 300) ||
    (expectedStatusCodes || []).includes(response?.statusCode)
  ) {
    return callback(null, response, body)
  } else if (response?.statusCode === 403) {
    error = new Errors.ForbiddenError('overleaf v1 returned forbidden')
    error.statusCode = response.statusCode
    return callback(error)
  } else if (response?.statusCode === 404) {
    error = new Errors.NotFoundError(
      `overleaf v1 returned non-success code: ${response.statusCode} ${options.method} ${options.uri}`
    )
    error.statusCode = response.statusCode
    return callback(error)
  } else {
    error = new OError('overleaf v1 returned non-success code', {
      status: response?.statusCode,
      method: options.method,
      url: options.uri,
    })
    error.statusCode = response?.statusCode
    return callback(error)
  }
}

const V1Api = {
  request: makeRequest,
}

V1Api.promises = {
  request: promisifyMultiResult(V1Api.request, ['response', 'body']),
}
export default V1Api
