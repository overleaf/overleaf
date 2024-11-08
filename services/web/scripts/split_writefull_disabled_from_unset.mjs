import { db } from '../app/src/infrastructure/mongodb.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'
import mongodb from 'mongodb-legacy'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const { ObjectId } = mongodb
const CHUNK_SIZE = 1000

// Function to chunk the array
function chunkArray(array, size) {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

async function main() {
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
    { $set: { 'writefull.enabled': null } }
  )

  const chunks = chunkArray(optedOutList, CHUNK_SIZE)

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
    await main()
    process.exit(0)
  } catch (error) {
    console.error({ error })
    process.exit(1)
  }
}
