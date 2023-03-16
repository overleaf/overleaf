const runScript = require('../scripts/back_fill_doc_rev')

exports.tags = ['server-ce', 'server-pro']

exports.migrate = async () => {
  await runScript(false)
}

exports.rollback = async () => {}
