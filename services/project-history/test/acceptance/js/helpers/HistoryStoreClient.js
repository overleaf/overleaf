/* eslint-disable
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
import { expect } from 'chai'
import request from 'request'
import Settings from '@overleaf/settings'

export function getLatestContent(olProjectId, callback) {
  if (callback == null) {
    callback = function () {}
  }
  return request.get(
    {
      url: `${Settings.overleaf.history.host}/projects/${olProjectId}/latest/content`,
      auth: {
        user: Settings.overleaf.history.user,
        pass: Settings.overleaf.history.pass,
        sendImmediately: true,
      },
    },
    (error, res, body) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        callback(
          new Error(
            `history store a non-success status code: ${res.statusCode}`
          )
        )
      }

      return callback(error, JSON.parse(body))
    }
  )
}
