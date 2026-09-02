import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from './lib/mongodb.mjs'

const tags = ['saas']

// Keep in sync with the indexes declared on the model
// (services/web/app/src/models/StudentVerification.mjs): Mongoose runs with
// autoIndex: false, so nothing creates these automatically.
const indexes = [
  {
    // Every lookup of a single verification is by this id (status polling, the
    // webhook, and the mock outcome controls).
    key: { verificationId: 1 },
    unique: true,
    name: 'verificationId_1',
  },
  {
    // The purchase gate: the user's latest unexpired SUCCESS verification.
    key: { userId: 1, status: 1, createdAt: -1 },
    name: 'userId_1_status_1_createdAt_-1',
  },
  {
    // Retention: records carry their own `expires` date, so the TTL monitor
    // deletes each one at the time stored on it rather than after a fixed
    // interval.
    key: { expires: 1 },
    expireAfterSeconds: 0,
    name: 'expires_1',
  },
  {
    // The reconciliation poller
    // (modules/student-verification/scripts/reconcile_student_verifications.mjs)
    // sweeps pending records by refresh staleness, with no userId to narrow
    // on, so the {userId, status, createdAt} index cannot serve it and the DB
    // runs with notablescan.
    key: { status: 1, lastRefreshedAt: 1 },
    name: 'status_1_lastRefreshedAt_1',
  },
]

const migrate = async () => {
  const studentVerifications = await getCollectionInternal(
    'studentVerifications'
  )
  await Helpers.addIndexesToCollection(studentVerifications, indexes)
}

const rollback = async () => {
  const studentVerifications = await getCollectionInternal(
    'studentVerifications'
  )
  await Helpers.dropIndexesFromCollection(studentVerifications, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
