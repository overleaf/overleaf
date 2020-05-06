// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, ['docSnapshots'])

module.exports = {
  db,
  ObjectId: mongojs.ObjectId,
  healthCheck(callback) {
    return db.runCommand({ ping: 1 }, function (err, res) {
      if (err != null) {
        return callback(err)
      }
      if (!res.ok) {
        return callback(new Error('failed mongo ping'))
      }
      return callback()
    })
  }
}
