import {
  db,
  READ_PREFERENCE_SECONDARY,
} from '../app/src/infrastructure/mongodb.js'
import { promiseMapWithLimit } from '@overleaf/promise-utils'
import TokenGenerator from '../app/src/Features/TokenGenerator/TokenGenerator.js'
import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true'
const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 100
// persist fallback in order to keep batchedUpdate in-sync
process.env.BATCH_SIZE = BATCH_SIZE

async function rewriteDuplicates(duplicateReferralIds) {
  // duplicateReferralIds contains at least one duplicate.
  // Find out which is the duplicate in parallel and update
  //  any users if necessary.
  await promiseMapWithLimit(
    WRITE_CONCURRENCY,
    duplicateReferralIds,
    async referralId => {
      try {
        const users = await db.users
          .find(
            { referal_id: referralId },
            {
              projection: { _id: 1 },
              readPreference: READ_PREFERENCE_SECONDARY,
            }
          )
          .toArray()

        if (users.length === 1) {
          // This referral id was part of a batch of duplicates.
          // Keep the write load low and skip the update.
          return
        }
        if (VERBOSE_LOGGING) {
          console.log('Found duplicate:', referralId)
        }

        for (const user of users) {
          const newReferralId = TokenGenerator.generateReferralId()
          await db.users.updateOne(
            { _id: user._id },
            {
              $set: {
                referal_id: newReferralId,
              },
            }
          )
        }
      } catch (error) {
        console.error(
          { err: error },
          `Failed to generate new referral ID for duplicate ID: ${referralId}`
        )
      }
    }
  )
}

async function processBatch(users) {
  const uniqueReferalIdsInBatch = Array.from(
    new Set(users.map(user => user.referal_id))
  )
  if (uniqueReferalIdsInBatch.length !== users.length) {
    if (VERBOSE_LOGGING) {
      console.log('Got duplicates from looking at batch.')
    }
    await rewriteDuplicates(uniqueReferalIdsInBatch)
    return
  }
  const matches = await db.users
    .find(
      { referal_id: { $in: uniqueReferalIdsInBatch } },
      {
        readPreference: READ_PREFERENCE_SECONDARY,
        projection: { _id: true },
      }
    )
    .toArray()
  if (matches.length !== uniqueReferalIdsInBatch.length) {
    if (VERBOSE_LOGGING) {
      console.log('Got duplicates from running count.')
    }
    await rewriteDuplicates(uniqueReferalIdsInBatch)
  }
}

async function main() {
  await batchedUpdate(
    db.users,
    { referal_id: { $exists: true } },
    processBatch,
    { _id: 1, referal_id: 1 }
  )
}

main()
  .then(() => {
    console.error('Done.')
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
