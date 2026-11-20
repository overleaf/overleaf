import mongodb from 'mongodb-legacy'
import SessionManager from '../Authentication/SessionManager.mjs'
import ContactManager from './ContactManager.mjs'
import UserGetter from '../User/UserGetter.mjs'
import { User } from '../../models/User.mjs'
import Modules from '../../infrastructure/Modules.mjs'
import { expressify } from '@overleaf/promise-utils'

const { ObjectId } = mongodb

function _formatContact(contact) {
  return {
    id: contact._id?.toString(),
    email: contact.email || '',
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    type: 'user',
  }
}

const MAX_CONTACTS = 50
const MAX_WORKSPACE_DIRECTORY_USERS = 200

async function getContacts(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (!userId) {
    return res.json({ contacts: [] })
  }

  const contactIds = await ContactManager.promises.getContactIds(
    userId,
    MAX_CONTACTS
  )

  let contacts = await UserGetter.promises.getUsers(contactIds, {
    email: 1,
    first_name: 1,
    last_name: 1,
    holdingAccount: 1,
    suspended: 1,
  })

  // UserGetter.getUsers may not preserve order so put them back in order
  const positions = {}
  for (let i = 0; i < contactIds.length; i++) {
    const contactId = contactIds[i]
    positions[contactId] = i
  }
  contacts.sort(
    (a, b) => positions[a._id?.toString()] - positions[b._id?.toString()]
  )

  // Don't count holding or suspended accounts
  contacts = contacts.filter(c => !c.holdingAccount && !c.suspended)

  contacts = contacts.map(_formatContact)

  const additionalContacts = await Modules.promises.hooks.fire(
    'getContacts',
    userId,
    contacts
  )

  contacts = contacts.concat(...(additionalContacts || []))

  // Append active workspace users so coworker search-by-name-or-email works
  // natively in both LAN/zero-SMTP and cloud deployments.
  const selfFilter = ObjectId.isValid(String(userId))
    ? { $ne: new ObjectId(String(userId)) }
    : { $ne: userId }
  const workspaceUsers = await User.find(
    {
      _id: selfFilter,
      suspended: { $ne: true },
      holdingAccount: { $ne: true },
    },
    { email: 1, first_name: 1, last_name: 1 }
  )
    .sort({ first_name: 1, last_name: 1, email: 1 })
    .limit(MAX_WORKSPACE_DIRECTORY_USERS)
    .lean()

  const seenIds = new Set(contacts.map(c => c.id).filter(Boolean))
  const seenEmails = new Set(
    contacts.map(c => (c.email || '').toLowerCase()).filter(Boolean)
  )

  for (const user of workspaceUsers) {
    const formatted = _formatContact(user)
    const emailKey = formatted.email.toLowerCase()
    if (
      (formatted.id && seenIds.has(formatted.id)) ||
      (emailKey && seenEmails.has(emailKey))
    ) {
      continue
    }
    if (formatted.id) seenIds.add(formatted.id)
    if (emailKey) seenEmails.add(emailKey)
    contacts.push(formatted)
  }

  return res.json({
    contacts,
  })
}

export default {
  getContacts: expressify(getContacts),
}
