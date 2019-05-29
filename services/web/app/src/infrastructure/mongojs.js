/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const Settings = require('settings-sharelatex')
const mongojs = require('mongojs')
const db = mongojs(Settings.mongo.url, [
  'projects',
  'users',
  'userstubs',
  'tokens',
  'docSnapshots',
  'projectHistoryFailures'
])
module.exports = {
  db,
  ObjectId: mongojs.ObjectId
}
