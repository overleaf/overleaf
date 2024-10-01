const Helpers = require('./lib/helpers')
const { samlLogsIndexes } = require('./20191106102104_saml-log-indexes')
const { usersIndexes } = require('./20191107191318_saml-indentifiers-index')

exports.tags = ['saas']

exports.migrate = async ({ db }) => {
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

exports.rollback = async () => {}
