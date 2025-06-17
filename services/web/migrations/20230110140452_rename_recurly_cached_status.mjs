import { batchedUpdate } from '@overleaf/mongo-utils/batchedUpdate.js'

const tags = ['saas']

const migrate = async client => {
  const { db } = client
  // 'recurly' -> 'recurlyStatus'
  await batchedUpdate(
    db.subscriptions,
    {
      $and: [
        { recurlyStatus: { $exists: false } },
        { recurly: { $exists: true } },
      ],
    },
    { $rename: { recurly: 'recurlyStatus' } }
  )
  // some records may have already recached the recurly status, discard old cache
  await batchedUpdate(
    db.subscriptions,
    {
      $and: [
        { recurlyStatus: { $exists: true } },
        { recurly: { $exists: true } },
      ],
    },
    { $unset: { recurly: 1 } }
  )
}

const rollback = async client => {
  const { db } = client
  // 'recurlyStatus' -> 'recurly'
  await batchedUpdate(
    db.subscriptions,
    {
      $and: [
        { recurly: { $exists: false } },
        { recurlyStatus: { $exists: true } },
      ],
    },
    { $rename: { recurlyStatus: 'recurly' } }
  )
  // some records may have already recached the recurly status, discard old cache
  await batchedUpdate(
    db.subscriptions,
    {
      $and: [
        { recurlyStatus: { $exists: true } },
        { recurly: { $exists: true } },
      ],
    },
    { $unset: { recurlyStatus: 1 } }
  )
}

export default {
  tags,
  migrate,
  rollback,
}
