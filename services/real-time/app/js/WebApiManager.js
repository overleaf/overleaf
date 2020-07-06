/* eslint-disable
    camelcase,
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let WebApiManager
const request = require('request')
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const { CodedError } = require('./Errors')

module.exports = WebApiManager = {
  joinProject(project_id, user, callback) {
    if (callback == null) {
      callback = function (error, project, privilegeLevel, isRestrictedUser) {}
    }
    const user_id = user._id
    logger.log({ project_id, user_id }, 'sending join project request to web')
    const url = `${settings.apis.web.url}/project/${project_id}/join`
    const headers = {}
    if (user.anonymousAccessToken != null) {
      headers['x-sl-anonymous-access-token'] = user.anonymousAccessToken
    }
    return request.post(
      {
        url,
        qs: { user_id },
        auth: {
          user: settings.apis.web.user,
          pass: settings.apis.web.pass,
          sendImmediately: true
        },
        json: true,
        jar: false,
        headers
      },
      function (error, response, data) {
        let err
        if (error != null) {
          return callback(error)
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (
            data == null ||
            (data != null ? data.project : undefined) == null
          ) {
            err = new Error('no data returned from joinProject request')
            logger.error(
              { err, project_id, user_id },
              'error accessing web api'
            )
            return callback(err)
          }
          return callback(
            null,
            data.project,
            data.privilegeLevel,
            data.isRestrictedUser
          )
        } else if (response.statusCode === 429) {
          logger.log(project_id, user_id, 'rate-limit hit when joining project')
          return callback(
            new CodedError(
              'rate-limit hit when joining project',
              'TooManyRequests'
            )
          )
        } else {
          err = new Error(
            `non-success status code from web: ${response.statusCode}`
          )
          logger.error({ err, project_id, user_id }, 'error accessing web api')
          return callback(err)
        }
      }
    )
  }
}
