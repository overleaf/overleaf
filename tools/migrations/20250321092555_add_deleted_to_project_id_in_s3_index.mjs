import Helpers from './lib/helpers.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const oldIndex = {
  key: { project_id: 1, inS3: 1 },
  name: 'project_id_1_inS3_1',
}

const newIndex = {
  key: { project_id: 1, inS3: 1, deleted: 1 },
  name: 'project_id_1_inS3_1_deleted_1',
}

const migrate = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.docs, [newIndex])
  await Helpers.dropIndexesFromCollection(db.docs, [oldIndex])
}

const rollback = async client => {
  const { db } = client
  await Helpers.addIndexesToCollection(db.docs, [oldIndex])
  await Helpers.dropIndexesFromCollection(db.docs, [newIndex])
}

export default {
  tags,
  migrate,
  rollback,
}
