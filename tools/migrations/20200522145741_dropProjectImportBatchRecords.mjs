import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const migrate = async client => {
  await Helpers.dropCollection('projectImportBatchRecords')
}

const rollback = async client => {
  // can't really do anything here
}

export default {
  tags,
  migrate,
  rollback,
}
