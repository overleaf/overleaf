/* eslint-disable
    n/handle-callback-err,
    max-len,
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
let ContactManager
const OError = require('@overleaf/o-error')
const request = require('request')
const settings = require('@overleaf/settings')

module.exports = ContactManager = {
  getContactIds(userId, options, callback) {
    if (options == null) {
      options = { limits: 50 }
    }
    if (callback == null) {
      callback = function () {}
    }
    const url = `${settings.apis.contacts.url}/user/${userId}/contacts`
    return request.get(
      {
        url,
        qs: options,
        json: true,
        jar: false,
      },
      function (error, res, data) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(
            null,
            (data != null ? data.contact_ids : undefined) || []
          )
        } else {
          error = new OError(
            `contacts api responded with non-success code: ${res.statusCode}`,
            { user_id: userId }
          )
          return callback(error)
        }
      }
    )
  },

  addContact(userId, contactId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const url = `${settings.apis.contacts.url}/user/${userId}/contacts`
    return request.post(
      {
        url,
        json: {
          contact_id: contactId,
        },
        jar: false,
      },
      function (error, res, data) {
        if (error != null) {
          return callback(error)
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return callback(
            null,
            (data != null ? data.contact_ids : undefined) || []
          )
        } else {
          error = new OError(
            `contacts api responded with non-success code: ${res.statusCode}`,
            {
              user_id: userId,
              contact_id: contactId,
            }
          )
          return callback(error)
        }
      }
    )
  },
}
