import Helper from './lib/helpers.mjs'
const { dropCollection } = Helper

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async () => {
  await dropCollection('docOps')
}

const rollback = async client => {
  // there's no rollback: we can't recover the data
}

export default {
  tags,
  migrate,
  rollback,
}
