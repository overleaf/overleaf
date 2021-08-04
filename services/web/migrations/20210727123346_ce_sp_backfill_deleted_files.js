const runScript = require('../scripts/back_fill_deleted_files.js')

exports.tags = ['server-ce', 'server-pro', 'saas']

exports.migrate = async client => {
  const options = {
    performCleanup: true,
    letUserDoubleCheckInputsFor: 10,
    fixPartialInserts: true,
  }
  await runScript(options)
}

exports.rollback = async client => {}
