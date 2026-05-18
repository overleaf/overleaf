import { callbackify } from 'node:util'
import { db, ObjectId } from '../../infrastructure/mongodb.mjs'

async function touchContact(userId, contactId) {
  await db.contacts.updateOne(
    { user_id: new ObjectId(userId.toString()) },
    {
      $inc: { [`contacts.${contactId}.n`]: 1 },
      $set: { [`contacts.${contactId}.ts`]: new Date() },
    },
    { upsert: true }
  )
}

async function getContactIds(userId, limit) {
  const user = await db.contacts.findOne({
    user_id: new ObjectId(userId.toString()),
  })

  return buildContactIds(user?.contacts, limit)
}

async function addContact(userId, contactId) {
  await Promise.all([
    touchContact(userId, contactId),
    touchContact(contactId, userId),
  ])
}

// sort by decreasing count, decreasing timestamp.
// i.e. highest count, most recent first.
function sortContacts(a, b) {
  return a.n === b.n ? b.ts - a.ts : b.n - a.n
}

function buildContactIds(contacts, limit) {
  return Object.entries(contacts || {})
    .map(([id, { n, ts }]) => ({ id, n, ts }))
    .sort(sortContacts)
    .slice(0, limit)
    .map(contact => contact.id)
}

export default {
  getContactIds: callbackify(getContactIds),
  addContact: callbackify(addContact),
  promises: {
    getContactIds,
    addContact,
  },
}
