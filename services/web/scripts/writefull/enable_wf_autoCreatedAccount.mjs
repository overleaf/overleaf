import { db } from '../../app/src/infrastructure/mongodb.mjs'
import mongodb from 'mongodb-legacy'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chunkArray } from '../helpers/chunkArray.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const { ObjectId } = mongodb

async function main() {
  // search for file of users to transition
  const userIdsPath = process.argv[2]
  const userIdsFile = fs.readFileSync(userIdsPath, 'utf8')
  let userIdsList = userIdsFile

  userIdsList = userIdsList
    .split('\n')
    .filter(id => id?.length)
    .map(id => new ObjectId(id))

  const chunks = chunkArray(userIdsList)
  console.log(
    `transitioning ${userIdsList.length} users to auto-account-created state in ${chunks.length} chunks`
  )

  // Iterate over each chunk and update their autoAccountCreated flag
  for (const chunkedIds of chunks) {
    console.log('batch update started')
    await db.users.updateMany(
      { _id: { $in: chunkedIds } },
      { $set: { 'writefull.autoCreatedAccount': true } }
    )
    console.log('batch completed')
  }
}

export default main

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await scriptRunner(main)
    process.exit(0)
  } catch (error) {
    console.error({ error })
    process.exit(1)
  }
}
