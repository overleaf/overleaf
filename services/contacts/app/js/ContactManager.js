/* eslint-disable
    camelcase,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ContactManager
const { db, ObjectId } = require('./mongodb')
const logger = require('logger-sharelatex')
const metrics = require('@overleaf/metrics')

module.exports = ContactManager = {
  touchContact(user_id, contact_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    try {
      user_id = ObjectId(user_id.toString())
    } catch (error1) {
      const error = error1
      return callback(error)
    }

    const update = { $set: {}, $inc: {} }
    update.$inc[`contacts.${contact_id}.n`] = 1
    update.$set[`contacts.${contact_id}.ts`] = new Date()

    db.contacts.updateOne(
      {
        user_id,
      },
      update,
      {
        upsert: true,
      },
      callback
    )
  },

  getContacts(user_id, callback) {
    if (callback == null) {
      callback = function () {}
    }
    try {
      user_id = ObjectId(user_id.toString())
    } catch (error1) {
      const error = error1
      return callback(error)
    }

    return db.contacts.findOne(
      {
        user_id,
      },
      function (error, user) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, user != null ? user.contacts : undefined)
      }
    )
  },
}
;['touchContact', 'getContacts'].map(method =>
  metrics.timeAsyncMethod(
    ContactManager,
    method,
    'mongo.ContactManager',
    logger
  )
)
