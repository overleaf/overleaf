/* eslint-disable no-unused-vars */

import Helpers from './lib/helpers.mjs'

// Environments this migration should run in: 'server-ce', 'server-pro', 'saas'.
// Two extra tags are also supported:
//   'auxiliary'   - the migration operates on collections on the auxiliary Mongo cluster
//   'nonblocking' - deployments may go through while this migration is pending
// See the README for details.
const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async client => {
  const { db } = client
  // Are there migrations that need to run before this migration?
  // Use the following helper to enforce the dependency:
  //
  // await Helpers.assertDependency('20200101000000_another_migration')

  // await Helpers.addIndexesToCollection(db.wombats, [{ name: 1 }])
}

const rollback = async client => {
  const { db } = client
  // await Helpers.dropIndexesFromCollection(db.wombats, [{ name: 1 }])
}

export default {
  tags,
  migrate,
  rollback,
}
