const runScript = require('../scripts/migrate_audit_logs.js')

exports.tags = ['server-ce', 'server-pro']

exports.migrate = async () => {
  const options = {
    letUserDoubleCheckInputsFor: 10,
    writeConcurrency: 5,
    dryRun: false,
  }
  await runScript(options)
}

exports.rollback = async () => {}
