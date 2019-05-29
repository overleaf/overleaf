// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const metrics = require('metrics-sharelatex')
module.exports = {
  log(req) {
    if (req.headers['user-agent'] != null) {
      const userAgent = req.headers['user-agent'].toLowerCase()
      if (userAgent.indexOf('google') !== -1) {
        return metrics.inc('crawler.google')
      } else if (userAgent.indexOf('facebook') !== -1) {
        return metrics.inc('crawler.facebook')
      } else if (userAgent.indexOf('bing') !== -1) {
        return metrics.inc('crawler.bing')
      }
    }
  }
}
