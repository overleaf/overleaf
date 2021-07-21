/* eslint-disable no-unused-vars */

const Helpers = require('./lib/helpers')

exports.tags = ['server-ce', 'server-pro', 'saas']

const indexes = {
  docSnapshots: [{ key: { project_id: 1, ts: 1 }, name: 'project_id_1_ts_1' }],
  deletedProjects: [
    {
      key: { 'deleterData.deletedProjectOwnerId': 1 },
      name: 'deleterdata_deletedProjectOwnerId_1',
    },
  ],
  docs: [{ key: { project_id: 1, inS3: 1 }, name: 'project_id_1_inS3_1' }],
}

exports.migrate = async client => {
  const { db } = client

  await Promise.all(
    Object.keys(indexes).map(key =>
      Helpers.addIndexesToCollection(db[key], indexes[key])
    )
  )
}

exports.rollback = async client => {
  const { db } = client

  await Promise.all(
    Object.keys(indexes).map(key =>
      Helpers.dropIndexesFromCollection(db[key], indexes[key])
    )
  )
}
