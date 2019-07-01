/* eslint-disable
    handle-callback-err,
    max-len,
    standard/no-callback-literal,
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
let AnnouncementsHandler
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const BlogHandler = require('../Blog/BlogHandler')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')
const async = require('async')
const _ = require('lodash')

module.exports = AnnouncementsHandler = {
  _domainSpecificAnnouncements(email) {
    const domainSpecific = _.filter(
      settings != null ? settings.domainAnnouncements : undefined,
      function(domainAnnouncment) {
        const matches = _.filter(
          domainAnnouncment.domains,
          domain => email.indexOf(domain) !== -1
        )
        return matches.length > 0 && domainAnnouncment.id != null
      }
    )
    return domainSpecific || []
  },

  getUnreadAnnouncements(user, callback) {
    if (callback == null) {
      callback = function(err, announcements) {}
    }
    if (user == null && user._id == null) {
      return callback(new Error('user not supplied'))
    }

    const timestamp = user._id.toString().substring(0, 8)
    const userSignupDate = new Date(parseInt(timestamp, 16) * 1000)

    return async.parallel(
      {
        lastEvent(cb) {
          return AnalyticsManager.getLastOccurrence(
            user._id,
            'announcement-alert-dismissed',
            cb
          )
        },
        announcements(cb) {
          return BlogHandler.getLatestAnnouncements(cb)
        }
      },
      function(err, results) {
        if (err != null) {
          logger.warn(
            { err, user_id: user._id },
            'error getting unread announcements'
          )
          return callback(err)
        }

        let domainSpecific = AnnouncementsHandler._domainSpecificAnnouncements(
          user != null ? user.email : undefined
        )

        domainSpecific = _.map(domainSpecific, function(domainAnnouncment) {
          try {
            domainAnnouncment.date = new Date(domainAnnouncment.date)
            return domainAnnouncment
          } catch (e) {
            return callback(e)
          }
        })

        let { announcements } = results
        announcements = _.union(announcements, domainSpecific)
        announcements = _.sortBy(announcements, 'date').reverse()

        const lastSeenBlogId = __guard__(
          __guard__(
            results != null ? results.lastEvent : undefined,
            x1 => x1.segmentation
          ),
          x => x.blogPostId
        )

        const announcementIndex = _.findIndex(
          announcements,
          announcement => announcement.id === lastSeenBlogId
        )

        announcements = _.map(announcements, function(announcement, index) {
          let read
          if (announcement.date < userSignupDate) {
            read = true
          } else if (announcementIndex === -1) {
            read = false
          } else if (index >= announcementIndex) {
            read = true
          } else {
            read = false
          }
          announcement.read = read
          return announcement
        })

        logger.log(
          {
            announcementsLength:
              announcements != null ? announcements.length : undefined,
            user_id: user != null ? user._id : undefined
          },
          'returning announcements'
        )

        return callback(null, announcements)
      }
    )
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
