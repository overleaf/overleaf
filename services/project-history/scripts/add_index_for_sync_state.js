/* eslint-env mongo */

// add a TTL index to expire entries for completed resyncs in the
// projectHistorySyncState collection.  The entries should only be expired if
// resyncProjectStructure is false and resyncDocContents is a zero-length array.

const now = Date.now()
const inTheFuture = now + 24 * 3600 * 1000

db.projectHistorySyncState.ensureIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, background: true }
)
db.projectHistorySyncState.updateMany(
  {
    resyncProjectStructure: false,
    resyncDocContents: [],
    expiresAt: { $exists: false },
  },
  { $set: { expiresAt: new Date(inTheFuture) } }
)
