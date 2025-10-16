import { db } from './lib/mongodb.mjs'
const tags = ['server-ce', 'server-pro']

const migrate = async () => {
  await db.users.updateMany({}, { $set: { 'features.gitBridge': true } })
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
