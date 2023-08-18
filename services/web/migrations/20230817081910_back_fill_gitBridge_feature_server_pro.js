exports.tags = ['server-ce', 'server-pro']

exports.migrate = async () => {
  // Run-time import as SaaS does not ship with the server-ce-scripts module
  const runScript = require('../modules/server-ce-scripts/scripts/upgrade-user-features')
  await runScript(false, {
    gitBridge: 1,
  })
}

exports.rollback = async () => {}
