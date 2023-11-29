const { db, waitForDb } = require('../app/src/infrastructure/mongodb')
const { batchedUpdateWithResultHandling } = require('./helpers/batchedUpdate')
const { UserAuditLogEntry } = require('../app/src/models/UserAuditLogEntry')
const DRY_RUN = process.env.DRY_RUN !== 'false'

const VARIANTS = [
  {
    query: { sharelatexHashedPassword: { $exists: true } },
    update: { $unset: { sharelatexHashedPassword: true } },
  },
  {
    query: { hashedPassword: { $regex: /^[0-9a-f]{64}$/ } },
    update: { $unset: { hashedPassword: true } },
  },
]

if (require.main === module) {
  batchedUpdateWithResultHandling(
    'users',
    { $or: VARIANTS.map(variant => variant.query) },
    async users => {
      const userIds = users.map(user => user._id)
      if (DRY_RUN) {
        console.warn(`Running in dry-run mode. Skipping updates for ${userIds}`)
        return
      }
      for (const userId of userIds) {
        await UserAuditLogEntry.create({
          userId,
          operation: 'purge-legacy-password',
          info: { script: true },
        })
      }
      await waitForDb()
      for (const { query, update } of VARIANTS) {
        await db.users.updateMany({ _id: { $in: userIds }, ...query }, update)
      }
    }
  )
}
