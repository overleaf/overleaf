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
let HttpController
const ContactManager = require('./ContactManager')
const logger = require('logger-sharelatex')

module.exports = HttpController = {
  addContact(req, res, next) {
    const { user_id } = req.params
    const { contact_id } = req.body

    if (contact_id == null || contact_id === '') {
      res.status(400).send('contact_id should be a non-blank string')
      return
    }

    logger.log({ user_id, contact_id }, 'adding contact')

    return ContactManager.touchContact(user_id, contact_id, function (error) {
      if (error != null) {
        return next(error)
      }
      return ContactManager.touchContact(contact_id, user_id, function (error) {
        if (error != null) {
          return next(error)
        }
        return res.sendStatus(204)
      })
    })
  },

  CONTACT_LIMIT: 50,
  getContacts(req, res, next) {
    let limit
    let { user_id } = req.params

    if ((req.query != null ? req.query.limit : undefined) != null) {
      limit = parseInt(req.query.limit, 10)
    } else {
      limit = HttpController.CONTACT_LIMIT
    }
    limit = Math.min(limit, HttpController.CONTACT_LIMIT)

    logger.log({ user_id }, 'getting contacts')

    return ContactManager.getContacts(user_id, function (error, contact_dict) {
      if (error != null) {
        return next(error)
      }

      let contacts = []
      const object = contact_dict || {}
      for (user_id in object) {
        const data = object[user_id]
        contacts.push({
          user_id,
          n: data.n,
          ts: data.ts,
        })
      }

      HttpController._sortContacts(contacts)
      contacts = contacts.slice(0, limit)
      const contact_ids = contacts.map(contact => contact.user_id)

      return res.status(200).send({
        contact_ids,
      })
    })
  },

  _sortContacts(contacts) {
    return contacts.sort(function (a, b) {
      // Sort by decreasing count, descreasing timestamp.
      // I.e. biggest count, and most recent at front.
      if (a.n > b.n) {
        return -1
      } else if (a.n < b.n) {
        return 1
      } else {
        if (a.ts > b.ts) {
          return -1
        } else if (a.ts < b.ts) {
          return 1
        } else {
          return 0
        }
      }
    })
  },
}
