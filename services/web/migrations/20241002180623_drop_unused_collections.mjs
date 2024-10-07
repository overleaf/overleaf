import Helpers from './lib/helpers.mjs'

const tags = ['saas']

const unusedCollections = [
  'githubBuilds',
  'githubRepos',
  'userstubs',
  'templates',
  'quotes',
  'folders',
  'files',
  'objectlabs-system',
  'objectlabs-system.admin.collections',
]

const migrate = async client => {
  for (const name of unusedCollections) {
    await Helpers.dropCollection(name)
  }
}

const rollback = async client => {
  // can't really do anything here
}

export default {
  tags,
  migrate,
  rollback,
}
