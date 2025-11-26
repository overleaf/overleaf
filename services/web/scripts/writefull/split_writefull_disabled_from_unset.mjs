import { db } from '../../app/src/infrastructure/mongodb.mjs'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import mongodb from 'mongodb-legacy'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chunkArray } from '../helpers/chunkArray.mjs'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const { ObjectId } = mongodb

async function main(trackProgress) {
  // search for file of users who already explicitly opted out first
  const optOutPath = process.argv[2]
  const optedOutFile = fs.readFileSync(optOutPath, 'utf8')
  let optedOutList = optedOutFile

  optedOutList = optedOutFile.split('\n').map(id => new ObjectId(id))

  console.log(`preserving opt-outs of ${optedOutList.length} users`)
  // update all applicable user models
  await batchedUpdate(
    db.users,
    { 'writefull.enabled': false }, // and is false
    { $set: { 'writefull.enabled': null } },
    undefined,
    undefined,
    { trackProgress }
  )

  const chunks = chunkArray(optedOutList)

  // then reset any explicit false back to being false
  // Iterate over each chunk and perform the query
  for (const chunkedIds of chunks) {
    console.log('batch update started')
    await db.users.updateMany(
      { _id: { $in: chunkedIds } },
      { $set: { 'writefull.enabled': false } }
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
