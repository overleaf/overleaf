import logger from '@overleaf/logger'
import * as ContactManager from './ContactManager.js'
import { buildContactIds } from './contacts.js'

const CONTACT_LIMIT = 50

export function addContact(req, res, next) {
  const { user_id: userId } = req.params
  const { contact_id: contactId } = req.body

  if (contactId == null || contactId === '') {
    res.status(400).send('contact_id should be a non-blank string')
    return
  }

  logger.debug({ userId, contactId }, 'adding contact')

  Promise.all([
    ContactManager.touchContact(userId, contactId),
    ContactManager.touchContact(contactId, userId),
  ])
    .then(() => {
      res.sendStatus(204)
    })
    .catch(error => {
      next(error)
    })
}

export function getContacts(req, res, next) {
  const { user_id: userId } = req.params
  const { limit } = req.query

  const contactLimit =
    limit == null ? CONTACT_LIMIT : Math.min(parseInt(limit, 10), CONTACT_LIMIT)

  logger.debug({ userId }, 'getting contacts')

  ContactManager.getContacts(userId)
    .then(contacts => {
      res.json({
        contact_ids: buildContactIds(contacts, contactLimit),
      })
    })
    .catch(error => {
      next(error)
    })
}
