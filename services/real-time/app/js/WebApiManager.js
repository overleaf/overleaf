import request from 'request'
import OError from '@overleaf/o-error'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import Errors from './Errors.js'

const {
  CodedError,
  CorruptedJoinProjectResponseError,
  NotAuthorizedError,
  WebApiRequestFailedError,
} = Errors

export default {
  joinProject(projectId, user, callback) {
    const userId = user._id
    logger.debug({ projectId, userId }, 'sending join project request to web')
    const url = `${settings.apis.web.url}/project/${projectId}/join`
    request.post(
      {
        url,
        auth: {
          user: settings.apis.web.user,
          pass: settings.apis.web.pass,
          sendImmediately: true,
        },
        json: {
          userId,
          anonymousAccessToken: user.anonymousAccessToken,
        },
        jar: false,
      },
      function (error, response, data) {
        if (error) {
          OError.tag(error, 'join project request failed')
          return callback(error)
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          if (!(data && data.project)) {
            return callback(new CorruptedJoinProjectResponseError())
          }
          const userMetadata = {
            isRestrictedUser: data.isRestrictedUser,
            isTokenMember: data.isTokenMember,
            isInvitedMember: data.isInvitedMember,
          }
          callback(null, data.project, data.privilegeLevel, userMetadata)
        } else if (response.statusCode === 429) {
          callback(
            new CodedError(
              'rate-limit hit when joining project',
              'TooManyRequests'
            )
          )
        } else if (response.statusCode === 403) {
          callback(new NotAuthorizedError())
        } else if (response.statusCode === 404) {
          callback(new CodedError('project not found', 'ProjectNotFound'))
        } else {
          callback(new WebApiRequestFailedError(response.statusCode))
        }
      }
    )
  },
}
