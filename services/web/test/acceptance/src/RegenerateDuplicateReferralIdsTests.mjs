import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { expect } from 'chai'
import logger from '@overleaf/logger'
import { filterOutput } from './helpers/settings.mjs'
import { db } from '../../../app/src/infrastructure/mongodb.js'
import { renderObjectId } from '@overleaf/mongo-utils/batchedUpdate.js'

const BATCH_SIZE = 100
let n = 0
function getUniqueReferralId() {
  return `unique_${n++}`
}
function getUserWithReferralId(referralId) {
  const email = `${Math.random()}@example.com`
  return {
    referal_id: referralId,
    // Make the unique indexes happy.
    email,
    emails: [{ email }],
  }
}
async function getBatch(batchCounter) {
  return (
    await db.users
      .find(
        {},
        {
          projection: { _id: 1 },
          skip: BATCH_SIZE * --batchCounter,
          limit: BATCH_SIZE,
        }
      )
      .toArray()
  ).map(user => user._id)
}

describe('RegenerateDuplicateReferralIds', function () {
  let firstBatch, secondBatch, thirdBatch, forthBatch, duplicateAcrossBatch
  beforeEach('insert duplicates', async function () {
    // full batch of duplicates
    await db.users.insertMany(
      Array(BATCH_SIZE)
        .fill(0)
        .map(() => {
          return getUserWithReferralId('duplicate1')
        })
    )
    firstBatch = await getBatch(1)

    // batch of 999 duplicates and 1 unique
    await db.users.insertMany(
      Array(BATCH_SIZE - 1)
        .fill(0)
        .map(() => {
          return getUserWithReferralId('duplicate2')
        })
        .concat([getUserWithReferralId(getUniqueReferralId())])
    )
    secondBatch = await getBatch(2)

    // duplicate outside batch
    duplicateAcrossBatch = getUniqueReferralId()
    await db.users.insertMany(
      Array(BATCH_SIZE - 1)
        .fill(0)
        .map(() => {
          return getUserWithReferralId(getUniqueReferralId())
        })
        .concat([getUserWithReferralId(duplicateAcrossBatch)])
    )
    thirdBatch = await getBatch(3)

    // no new duplicates onwards
    await db.users.insertMany(
      Array(BATCH_SIZE - 1)
        .fill(0)
        .map(() => {
          return getUserWithReferralId(getUniqueReferralId())
        })
        .concat([getUserWithReferralId(duplicateAcrossBatch)])
    )
    forthBatch = await getBatch(4)
  })

  let result
  beforeEach('run script', async function () {
    try {
      result = await promisify(exec)(
        [
          // set low BATCH_SIZE
          `BATCH_SIZE=${BATCH_SIZE}`,
          // log details on duplicate matching
          'VERBOSE_LOGGING=true',
          // disable verbose logging
          'LOG_LEVEL=ERROR',

          // actual command
          'node',
          'scripts/regenerate_duplicate_referral_ids.mjs',
        ].join(' ')
      )
    } catch (err) {
      // dump details like exit code, stdErr and stdOut
      logger.error({ err }, 'script failed')
      throw err
    }
  })

  it('should do the correct operations', function () {
    let { stderr: stdErr, stdout: stdOut } = result
    stdErr = stdErr.split('\n').filter(filterOutput)
    stdOut = stdOut.split('\n').filter(filterOutput)
    expect(stdErr).to.include.members([
      `Completed batch ending ${renderObjectId(firstBatch[BATCH_SIZE - 1])}`,
      `Completed batch ending ${renderObjectId(secondBatch[BATCH_SIZE - 1])}`,
      `Completed batch ending ${renderObjectId(thirdBatch[BATCH_SIZE - 1])}`,
      `Completed batch ending ${renderObjectId(forthBatch[BATCH_SIZE - 1])}`,
      'Done.',
    ])
    expect(stdOut.filter(filterOutput)).to.include.members([
      // only duplicates
      `Running update on batch with ids ${JSON.stringify(firstBatch)}`,
      'Got duplicates from looking at batch.',
      'Found duplicate: duplicate1',

      // duplicate in batch
      `Running update on batch with ids ${JSON.stringify(secondBatch)}`,
      'Got duplicates from looking at batch.',
      'Found duplicate: duplicate2',

      // duplicate with next batch
      `Running update on batch with ids ${JSON.stringify(thirdBatch)}`,
      'Got duplicates from running count.',
      `Found duplicate: ${duplicateAcrossBatch}`,

      // no new duplicates
      `Running update on batch with ids ${JSON.stringify(forthBatch)}`,
    ])
  })

  it('should give all users a unique refereal_id', async function () {
    const users = await db.users
      .find({}, { projection: { referal_id: 1 } })
      .toArray()
    const uniqueReferralIds = Array.from(
      new Set(users.map(user => user.referal_id))
    )
    expect(users).to.have.length(4 * BATCH_SIZE)
    expect(uniqueReferralIds).to.have.length(users.length)
  })
})
