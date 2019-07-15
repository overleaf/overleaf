/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let V1Api
const request = require('request')
const settings = require('settings-sharelatex')
const Errors = require('../Errors/Errors')

// TODO: check what happens when these settings aren't defined
const DEFAULT_V1_PARAMS = {
  baseUrl: settings.apis.v1.url,
  auth: {
    user: settings.apis.v1.user,
    pass: settings.apis.v1.pass
  },
  json: true,
  timeout: 30 * 1000
}

const v1Request = request.defaults(DEFAULT_V1_PARAMS)

const DEFAULT_V1_OAUTH_PARAMS = {
  baseUrl: settings.apis.v1.url,
  json: true,
  timeout: 30 * 1000
}

const v1OauthRequest = request.defaults(DEFAULT_V1_OAUTH_PARAMS)

module.exports = V1Api = {
  request(options, callback) {
    if (callback == null) {
      return request(options)
    }
    return v1Request(options, (error, response, body) =>
      V1Api._responseHandler(options, error, response, body, callback)
    )
  },

  oauthRequest(options, token, callback) {
    if (options.uri == null) {
      return callback(new Error('uri required'))
    }
    if (options.method == null) {
      options.method = 'GET'
    }
    options.auth = { bearer: token }
    return v1OauthRequest(options, (error, response, body) =>
      V1Api._responseHandler(options, error, response, body, callback)
    )
  },

  _responseHandler(options, error, response, body, callback) {
    if (error != null) {
      return callback(error, response, body)
    }
    if (
      (response.statusCode >= 200 && response.statusCode < 300) ||
      Array.from(options.expectedStatusCodes || []).includes(
        response.statusCode
      )
    ) {
      return callback(null, response, body)
    } else if (response.statusCode === 403) {
      error = new Errors.ForbiddenError('overleaf v1 returned forbidden')
      error.statusCode = response.statusCode
      return callback(error)
    } else {
      error = new Error(
        `overleaf v1 returned non-success code: ${response.statusCode} ${
          options.method
        } ${options.uri}`
      )
      error.statusCode = response.statusCode
      return callback(error)
    }
  }
}
