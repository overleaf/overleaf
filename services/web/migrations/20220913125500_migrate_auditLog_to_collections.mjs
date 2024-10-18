import runScript from '../scripts/migrate_audit_logs.mjs'

const tags = ['server-ce', 'server-pro', 'saas']

const migrate = async () => {
  const options = {
    letUserDoubleCheckInputsFor: 10,
    writeConcurrency: 5,
    dryRun: false,
  }
  await runScript(options)
}

const rollback = async () => {}

export default {
  tags,
  migrate,
  rollback,
}
