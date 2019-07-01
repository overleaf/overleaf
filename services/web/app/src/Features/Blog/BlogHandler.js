/* eslint-disable
    max-len,
    no-unused-vars,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let BlogHandler
const request = require('request')
const settings = require('settings-sharelatex')
const _ = require('underscore')
const logger = require('logger-sharelatex')

module.exports = BlogHandler = {
  getLatestAnnouncements(callback) {
    const blogUrl = `${settings.apis.blog.url}/blog/latestannouncements.json`
    const opts = {
      url: blogUrl,
      json: true,
      timeout: 1000
    }
    return request.get(opts, function(err, res, announcements) {
      if (err != null) {
        return callback(err)
      }
      if (res.statusCode !== 200) {
        return callback(new Error('blog announcement returned non 200'))
      }
      logger.log(
        {
          announcementsLength:
            announcements != null ? announcements.length : undefined
        },
        'announcements returned'
      )
      announcements = _.map(announcements, function(announcement) {
        announcement.date = new Date(announcement.date)
        return announcement
      })
      return callback(err, announcements)
    })
  }
}
