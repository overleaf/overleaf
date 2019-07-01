/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const AnnouncementsHandler = require('./AnnouncementsHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')

module.exports = {
  getUndreadAnnouncements(req, res, next) {
    if (
      __guard__(
        __guard__(
          settings != null ? settings.apis : undefined,
          x1 => x1.analytics
        ),
        x => x.url
      ) == null ||
      settings.apis.blog.url == null
    ) {
      return res.json([])
    }

    const user = AuthenticationController.getSessionUser(req)
    logger.log(
      { user_id: user != null ? user._id : undefined },
      'getting unread announcements'
    )
    return AnnouncementsHandler.getUnreadAnnouncements(user, function(
      err,
      announcements
    ) {
      if (err != null) {
        logger.warn(
          { err, user_id: user._id },
          'unable to get unread announcements'
        )
        return next(err)
      } else {
        return res.json(announcements)
      }
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
