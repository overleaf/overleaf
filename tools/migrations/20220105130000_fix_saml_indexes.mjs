import Helpers from './lib/helpers.mjs'
import SamlLogsIndexesMigration from './20191106102104_saml-log-indexes.mjs'
import SamlIndentifiersIndexMigration from './20191107191318_saml-indentifiers-index.mjs'

const { samlLogsIndexes } = SamlLogsIndexesMigration
const { usersIndexes } = SamlIndentifiersIndexMigration

const tags = ['saas']

const migrate = async ({ db }) => {
  // Fix-up the previous SAML migrations that were operating on collections with
  //  typos in their names.
  await Helpers.addIndexesToCollection(
    db.users,
    usersIndexes.map(index => {
      return Object.assign({}, index, { unique: true })
    })
  )
  await Helpers.addIndexesToCollection(db.samlLogs, samlLogsIndexes)
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
