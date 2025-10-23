import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const migrate = async () => {
  await Helpers.dropCollection('docHistory')
}

const rollback = async () => {
  // Can't really do anything here
}

export default {
  tags,
  migrate,
  rollback,
}
