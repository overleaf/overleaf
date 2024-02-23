const runScript = require('../scripts/remove_deleted_users_from_token_access_refs')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async () => {
  await runScript(false)
}

exports.rollback = async () => {}
