// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require('async')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const queue = async.queue(
  (task, cb) => task(cb),
  Settings.parallelSqlQueryLimit
)

queue.drain = () => logger.debug('all items have been processed')

module.exports = { queue }
