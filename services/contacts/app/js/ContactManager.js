import { db, ObjectId } from './mongodb.js'

export async function touchContact(userId, contactId) {
  await db.contacts.updateOne(
    { user_id: new ObjectId(userId.toString()) },
    {
      $inc: {
        [`contacts.${contactId}.n`]: 1,
      },
      $set: {
        [`contacts.${contactId}.ts`]: new Date(),
      },
    },
    { upsert: true }
  )
}

export async function getContacts(userId) {
  const user = await db.contacts.findOne({
    user_id: new ObjectId(userId.toString()),
  })

  return user?.contacts
}
