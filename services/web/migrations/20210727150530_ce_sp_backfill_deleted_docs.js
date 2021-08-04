const runScript = require('../scripts/back_fill_doc_name_for_deleted_docs.js')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async client => {
  const options = {
    performCleanup: true,
    letUserDoubleCheckInputsFor: 10,
  }
  await runScript(options)
}

exports.rollback = async client => {}
