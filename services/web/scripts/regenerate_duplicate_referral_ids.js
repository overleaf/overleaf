const WRITE_CONCURRENCY = parseInt(process.env.WRITE_CONCURRENCY, 10) || 10

const logger = require('logger-sharelatex')
const { db, waitForDb } = require('../app/src/infrastructure/mongodb')
const { promiseMapWithLimit } = require('../app/src/util/promises')
const TokenGenerator = require('../app/src/Features/TokenGenerator/TokenGenerator')
const UserUpdater = require('../app/src/Features/User/UserUpdater')

async function main() {
  logger.info({}, 'Regenerating duplicate referral IDs')

  await waitForDb()

  const duplicates = await db.users.aggregate(
    [
      { $match: { referal_id: { $exists: true } } },
      { $group: { _id: '$referal_id', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ],
    { allowDiskUse: true }
  )

  const duplicateReferralIds = []
  let duplicate
  while ((duplicate = await duplicates.next())) {
    duplicateReferralIds.push(duplicate._id)
  }
  logger.info(
    {},
    `Found ${duplicateReferralIds.length} duplicate referral ID to regenerate`
  )

  await promiseMapWithLimit(
    WRITE_CONCURRENCY,
    duplicateReferralIds,
    async referralId => {
      const users = await db.users
        .find({
          referal_id: referralId
        })
        .toArray()
      try {
        for (const user of users) {
          const newReferralId = TokenGenerator.generateReferralId()
          await UserUpdater.promises.updateUser(user._id, {
            $set: {
              referal_id: newReferralId
            }
          })
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

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error({ error })
    process.exit(1)
  })
