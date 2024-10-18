import BatchedUpdateScript from '../scripts/helpers/batchedUpdate.mjs'

const { batchedUpdate } = BatchedUpdateScript
const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async () => {
  await batchedUpdate(
    'users',
    { 'features.templates': { $exists: true } },
    { $unset: { 'features.templates': true } }
  )
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
