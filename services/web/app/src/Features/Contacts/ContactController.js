/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ContactsController
const AuthenticationController = require('../Authentication/AuthenticationController')
const ContactManager = require('./ContactManager')
const UserGetter = require('../User/UserGetter')
const logger = require('logger-sharelatex')
const Modules = require('../../infrastructure/Modules')

module.exports = ContactsController = {
  getContacts(req, res, next) {
    const user_id = AuthenticationController.getLoggedInUserId(req)
    return ContactManager.getContactIds(user_id, { limit: 50 }, function(
      error,
      contact_ids
    ) {
      if (error != null) {
        return next(error)
      }
      return UserGetter.getUsers(
        contact_ids,
        {
          email: 1,
          first_name: 1,
          last_name: 1,
          holdingAccount: 1
        },
        function(error, contacts) {
          if (error != null) {
            return next(error)
          }

          // UserGetter.getUsers may not preserve order so put them back in order
          const positions = {}
          for (let i = 0; i < contact_ids.length; i++) {
            const contact_id = contact_ids[i]
            positions[contact_id] = i
          }
          contacts.sort(
            (a, b) =>
              positions[a._id != null ? a._id.toString() : undefined] -
              positions[b._id != null ? b._id.toString() : undefined]
          )

          // Don't count holding accounts to discourage users from repeating mistakes (mistyped or wrong emails, etc)
          contacts = contacts.filter(c => !c.holdingAccount)

          contacts = contacts.map(ContactsController._formatContact)

          return Modules.hooks.fire('getContacts', user_id, contacts, function(
            error,
            additional_contacts
          ) {
            if (error != null) {
              return next(error)
            }
            contacts = contacts.concat(...Array.from(additional_contacts || []))
            return res.send({
              contacts
            })
          })
        }
      )
    })
  },

  _formatContact(contact) {
    return {
      id: contact._id != null ? contact._id.toString() : undefined,
      email: contact.email || '',
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      type: 'user'
    }
  }
}
