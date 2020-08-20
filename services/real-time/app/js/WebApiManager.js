/* eslint-disable
    camelcase,
*/
const request = require('request')
const OError = require('@overleaf/o-error')
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const { CodedError } = require('./Errors')

module.exports = {
  joinProject(project_id, user, callback) {
    const user_id = user._id
    logger.log({ project_id, user_id }, 'sending join project request to web')
    const url = `${settings.apis.web.url}/project/${project_id}/join`
    const headers = {}
    if (user.anonymousAccessToken) {
      headers['x-sl-anonymous-access-token'] = user.anonymousAccessToken
    }
    request.post(
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
        if (error) {
          OError.tag(error, 'join project request failed')
          return callback(error)
        }
        let err
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (!(data && data.project)) {
            err = new Error('no data returned from joinProject request')
            logger.error(
              { err, project_id, user_id },
              'error accessing web api'
            )
            return callback(err)
          }
          callback(
            null,
            data.project,
            data.privilegeLevel,
            data.isRestrictedUser
          )
        } else if (response.statusCode === 429) {
          logger.log(project_id, user_id, 'rate-limit hit when joining project')
          callback(
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
          callback(err)
        }
      }
    )
  }
}
