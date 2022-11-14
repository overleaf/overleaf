const runScript = require('../scripts/convert_archived_state')

exports.tags = ['server-ce', 'server-pro']

exports.migrate = async () => {
  await runScript('FIRST,SECOND')
}

exports.rollback = async () => {}
