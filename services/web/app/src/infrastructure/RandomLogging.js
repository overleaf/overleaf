/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let trackOpenSockets
const _ = require('underscore')
const metrics = require('metrics-sharelatex')
;(trackOpenSockets = function() {
  metrics.gauge(
    'http.open-sockets',
    _.size(require('http').globalAgent.sockets.length),
    0.5
  )
  return setTimeout(trackOpenSockets, 1000)
})()
