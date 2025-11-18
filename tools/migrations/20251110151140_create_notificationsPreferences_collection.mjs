import Helpers from './lib/helpers.mjs'
import { getCollectionInternal } from './lib/mongodb.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const indexes = [
  {
    // compound index for querying both global (project_id: null) and project-specific notification preferences
    key: {
      user_id: 1,
      project_id: 1,
    },
    unique: true,
    name: 'user_id_1_project_id_1',
  },
]

const migrate = async () => {
  const notificationsPreferences = await getCollectionInternal(
    'notificationsPreferences'
  )
  await Helpers.addIndexesToCollection(notificationsPreferences, indexes)
}

const rollback = async () => {
  const notificationsPreferences = await getCollectionInternal(
    'notificationsPreferences'
  )
  await Helpers.dropIndexesFromCollection(notificationsPreferences, indexes)
}

export default {
  tags,
  migrate,
  rollback,
}
